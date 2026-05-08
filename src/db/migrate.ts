import { pool } from "./index.js";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger.js";

/**
 * Idempotent bootstrap migration that aligns the database with the Drizzle
 * schema in `src/db/schema/*`. Only creates objects that don't already exist
 * so it's safe to run on every boot. For schema changes, use `drizzle-kit
 * generate` + `drizzle-kit migrate` (see package.json scripts).
 */
/**
 * Drops a table if its `user_id` (or `userId`) column exists with the wrong
 * data type (anything other than text). This handles the legacy schema where
 * user IDs were `integer` and incompatible with the new text/UUID model.
 * The table will be recreated by the CREATE TABLE IF NOT EXISTS block below.
 *
 * Tables passed here MUST be ones whose data is safe to lose on schema fix
 * (sessions, denormalized records, etc.). Do NOT include "User" — its rows
 * are the source of truth and must be migrated, not dropped.
 */
async function dropIfLegacyUserIdShape(
  client: import("pg").PoolClient,
  table: string,
  userIdColumn: string,
): Promise<void> {
  const { rows } = await client.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, userIdColumn],
  );
  if (rows.length === 0) return; // table or column doesn't exist yet — fine
  const dataType = rows[0].data_type as string;
  if (dataType !== "text") {
    logger.warn(
      { table, userIdColumn, dataType },
      "Dropping table with legacy user-id column type so it can be recreated with text IDs",
    );
    // CASCADE because some legacy tables had FKs to this one.
    await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
  }
}

// Stable lock key derived from the literal string "eagles_migrations" — keeps a
// single migration run across multi-instance deployments without contending
// with other advisory locks the app may use.
const MIGRATION_LOCK_KEY = 0x4541474c45534d49n;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  let acquiredLock = false;
  try {
    logger.info("Running database migrations...");

    // Serialize concurrent migrations across processes / replicas. The lock is
    // released either by the explicit unlock below or when the connection is
    // returned to the pool, so a crash mid-migration cannot leave it stuck.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY.toString()]);
    acquiredLock = true;

    // Wrap the entire migration in a single transaction. Any failure rolls
    // back every DDL / DML so we never leave the schema in a half-applied
    // state. Per-step CREATE / ALTER are still individually idempotent.
    await client.query("BEGIN");

    // ── Heal legacy schema ─────────────────────────────────────────────────
    // If the DB was first provisioned by an older version of this file (where
    // user_id columns were integers), drop those tables so the CREATE TABLE
    // IF NOT EXISTS block below can recreate them with the correct types.
    // The "User" table is preserved — its data is the source of truth.
    await dropIfLegacyUserIdShape(client, "refresh_tokens", "user_id");
    await dropIfLegacyUserIdShape(client, "member_subscriptions", "user_id");
    await dropIfLegacyUserIdShape(client, "training_programs", "user_id");
    await dropIfLegacyUserIdShape(client, "exercise_logs", "user_id");
    await dropIfLegacyUserIdShape(client, "body_stats", "user_id");
    await dropIfLegacyUserIdShape(client, "payments", "user_id");
    await dropIfLegacyUserIdShape(client, "CheckIn", "userId");

    // Rename legacy User columns if a previous version of this file created them
    // with different names. Safe to run unconditionally — does nothing if the
    // target column already exists.
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'password'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'passwordHash'
        ) THEN
          ALTER TABLE "User" RENAME COLUMN "password" TO "passwordHash";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'memberCode'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'membershipNumber'
        ) THEN
          ALTER TABLE "User" RENAME COLUMN "memberCode" TO "membershipNumber";
        END IF;
      END $$;
    `);

    // Normalize any uppercase legacy role values (e.g. "ADMIN", "MEMBER") to
    // lowercase so the new auth middleware accepts them. Idempotent.
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'role'
        ) THEN
          UPDATE "User" SET role = LOWER(role) WHERE role <> LOWER(role);
        END IF;
      END $$;
    `);

    // ── Enums ──────────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('admin', 'trainer', 'member');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE subscription_status AS ENUM ('active', 'expired');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('cash', 'card', 'transfer');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE expense_category AS ENUM ('rent','utilities','salaries','equipment','maintenance','marketing','other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE day_of_week AS ENUM ('saturday','sunday','monday','tuesday','wednesday','thursday','friday');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Tables ─────────────────────────────────────────────────────────────
    // NOTE: Column types and names must match `src/db/schema/*`. User-related
    // tables use opaque text IDs (cuid/UUID style) rather than serial integers.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id"               TEXT PRIMARY KEY,
        "name"             TEXT NOT NULL,
        "phone"            TEXT NOT NULL UNIQUE,
        "membershipNumber" TEXT UNIQUE,
        "passwordHash"     TEXT NOT NULL,
        "role"             TEXT NOT NULL DEFAULT 'member',
        "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        duration  INTEGER NOT NULL,
        price     NUMERIC(10,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS member_subscriptions (
        id              SERIAL PRIMARY KEY,
        user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        status          subscription_status NOT NULL DEFAULT 'active',
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        video_url      TEXT,
        target_muscle  TEXT NOT NULL,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workout_templates (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS workout_template_exercises (
        id           SERIAL PRIMARY KEY,
        template_id  INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        sets         INTEGER NOT NULL,
        reps         INTEGER NOT NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS member_workout_assignments (
        id           SERIAL PRIMARY KEY,
        template_id  INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        user_id      TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        assigned_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exercise_logs (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        set_number  INTEGER NOT NULL,
        reps        INTEGER NOT NULL,
        weight      NUMERIC(6,2) NOT NULL,
        date        DATE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS body_stats (
        id                SERIAL PRIMARY KEY,
        user_id           TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        date              DATE NOT NULL,
        weight            NUMERIC(6,2),
        body_fat          NUMERIC(5,2),
        diet_note         TEXT,
        performance_note  TEXT
      );

      CREATE TABLE IF NOT EXISTS "CheckIn" (
        "id"        TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
        "method"    TEXT NOT NULL DEFAULT 'MANUAL'
      );

      CREATE TABLE IF NOT EXISTS payments (
        id       SERIAL PRIMARY KEY,
        user_id  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        amount   NUMERIC(10,2) NOT NULL,
        date     DATE NOT NULL,
        method   payment_method NOT NULL DEFAULT 'cash'
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        revoked    BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id          SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        amount      NUMERIC(10,2) NOT NULL,
        date        DATE NOT NULL,
        category    expense_category NOT NULL DEFAULT 'other',
        notes       TEXT
      );

      CREATE TABLE IF NOT EXISTS schedule (
        id           SERIAL PRIMARY KEY,
        day_of_week  day_of_week NOT NULL,
        start_time   TEXT NOT NULL,
        end_time     TEXT NOT NULL,
        class_name   TEXT NOT NULL,
        trainer_name TEXT,
        capacity     INTEGER,
        location     TEXT
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id               SERIAL PRIMARY KEY,
        content          TEXT NOT NULL,
        interval_minutes INTEGER NOT NULL,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ── Fix legacy schemas ────────────────────────────────────────────────
    // Older deployments had user_id as INTEGER. Newer User.id is TEXT.
    // For tables where a mismatch is detected, drop and recreate with the
    // correct schema (legacy data was orphaned because integer ids cannot
    // reference the new TEXT UUIDs).
    async function userIdType(table: string): Promise<string | null> {
      const { rows } = await client.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'user_id'`,
        [table]
      );
      return rows[0]?.data_type ?? null;
    }

    if ((await userIdType("refresh_tokens")) === "integer") {
      logger.warn("Recreating refresh_tokens with TEXT user_id");
      await client.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE`);
      await client.query(`
        CREATE TABLE refresh_tokens (
          id         SERIAL PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          revoked    BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL
        )
      `);
    }

    // Migrate legacy refresh_tokens.token (plaintext) → token_hash. Existing
    // plaintext rows can't be retroactively hashed without the original token,
    // so they're truncated; users will simply have to log in again.
    const { rows: hasLegacyTokenCol } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='refresh_tokens' AND column_name='token'`
    );
    const { rows: hasTokenHashCol } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='refresh_tokens' AND column_name='token_hash'`
    );
    if (hasLegacyTokenCol.length > 0 && hasTokenHashCol.length === 0) {
      logger.warn("Migrating refresh_tokens.token → token_hash (clearing existing rows)");
      await client.query(`TRUNCATE TABLE refresh_tokens`);
      await client.query(`ALTER TABLE refresh_tokens DROP COLUMN token`);
      await client.query(`ALTER TABLE refresh_tokens ADD COLUMN token_hash TEXT NOT NULL UNIQUE`);
    } else if (hasLegacyTokenCol.length > 0 && hasTokenHashCol.length > 0) {
      logger.warn("Dropping legacy refresh_tokens.token column");
      await client.query(`ALTER TABLE refresh_tokens DROP COLUMN token`);
    }

    if ((await userIdType("member_subscriptions")) === "integer") {
      logger.warn("Recreating member_subscriptions with TEXT user_id (legacy data dropped)");
      await client.query(`DROP TABLE IF EXISTS member_subscriptions CASCADE`);
      await client.query(`
        CREATE TABLE member_subscriptions (
          id              SERIAL PRIMARY KEY,
          user_id         TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
          start_date      DATE NOT NULL,
          end_date        DATE NOT NULL,
          status          subscription_status NOT NULL DEFAULT 'active',
          created_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    if ((await userIdType("payments")) === "integer") {
      logger.warn("Recreating payments with TEXT user_id (legacy data dropped)");
      await client.query(`DROP TABLE IF EXISTS payments CASCADE`);
      await client.query(`
        CREATE TABLE payments (
          id       SERIAL PRIMARY KEY,
          user_id  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          amount   NUMERIC(10,2) NOT NULL,
          date     DATE NOT NULL,
          method   payment_method NOT NULL DEFAULT 'cash'
        )
      `);
    }

    if ((await userIdType("exercise_logs")) === "integer") {
      logger.warn("Recreating exercise_logs with TEXT user_id (legacy data dropped)");
      await client.query(`DROP TABLE IF EXISTS exercise_logs CASCADE`);
      await client.query(`
        CREATE TABLE exercise_logs (
          id          SERIAL PRIMARY KEY,
          user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          set_number  INTEGER NOT NULL,
          reps        INTEGER NOT NULL,
          weight      NUMERIC(6,2) NOT NULL,
          date        DATE NOT NULL
        )
      `);
    }

    if ((await userIdType("body_stats")) === "integer") {
      logger.warn("Recreating body_stats with TEXT user_id (legacy data dropped)");
      await client.query(`DROP TABLE IF EXISTS body_stats CASCADE`);
      await client.query(`
        CREATE TABLE body_stats (
          id                SERIAL PRIMARY KEY,
          user_id           TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          date              DATE NOT NULL,
          weight            NUMERIC(6,2),
          body_fat          NUMERIC(5,2),
          diet_note         TEXT,
          performance_note  TEXT
        )
      `);
    }

    // ── Drop old training tables (replaced by exercises + workout_templates) ─
    const { rows: oldTrainingWeeks } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'training_weeks'`
    );
    if (oldTrainingWeeks.length > 0) {
      logger.warn("Dropping legacy training tables (training_programs, training_weeks, old exercises)");
      await client.query(`DROP TABLE IF EXISTS exercise_logs CASCADE`);
      await client.query(`DROP TABLE IF EXISTS exercises CASCADE`);
      await client.query(`DROP TABLE IF EXISTS training_weeks CASCADE`);
      await client.query(`DROP TABLE IF EXISTS training_programs CASCADE`);
    }

    // If exercises table exists but still has old columns (week_id), drop and recreate
    const { rows: oldExCol } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'exercises' AND column_name = 'week_id'`
    );
    if (oldExCol.length > 0) {
      logger.warn("Dropping old exercises table with week_id column");
      await client.query(`DROP TABLE IF EXISTS exercise_logs CASCADE`);
      await client.query(`DROP TABLE IF EXISTS workout_template_exercises CASCADE`);
      await client.query(`DROP TABLE IF EXISTS exercises CASCADE`);
    }

    // Recreate new tables if they were just dropped
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        video_url      TEXT,
        target_muscle  TEXT NOT NULL,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workout_templates (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workout_template_exercises (
        id           SERIAL PRIMARY KEY,
        template_id  INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        sets         INTEGER NOT NULL,
        reps         INTEGER NOT NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS member_workout_assignments (
        id           SERIAL PRIMARY KEY,
        template_id  INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        user_id      TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        assigned_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        set_number  INTEGER NOT NULL,
        reps        INTEGER NOT NULL,
        weight      NUMERIC(6,2) NOT NULL,
        date        DATE NOT NULL
      );
    `);

    // ── Add day columns if missing ─────────────────────────────────────────
    const { rows: hasDaysCount } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_templates' AND column_name='days_count'`
    );
    if (hasDaysCount.length === 0) {
      logger.info("Adding days_count to workout_templates");
      await client.query(`ALTER TABLE workout_templates ADD COLUMN days_count INTEGER NOT NULL DEFAULT 1`);
    }
    const { rows: hasDayNumber } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_template_exercises' AND column_name='day_number'`
    );
    if (hasDayNumber.length === 0) {
      logger.info("Adding day_number to workout_template_exercises");
      await client.query(`ALTER TABLE workout_template_exercises ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1`);
    }

    const { rows: hasDaysPerWeek } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_templates' AND column_name='days_per_week'`
    );
    if (hasDaysPerWeek.length === 0) {
      logger.info("Adding days_per_week to workout_templates");
      await client.query(`ALTER TABLE workout_templates ADD COLUMN days_per_week INTEGER NOT NULL DEFAULT 4`);
    }

    // ── day_names & notes on templates ──────────────────────────────────────
    const { rows: hasDayNames } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_templates' AND column_name='day_names'`
    );
    if (hasDayNames.length === 0) {
      logger.info("Adding day_names to workout_templates");
      await client.query(`ALTER TABLE workout_templates ADD COLUMN day_names TEXT`);
    }
    const { rows: hasTemplateNotes } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_templates' AND column_name='notes'`
    );
    if (hasTemplateNotes.length === 0) {
      logger.info("Adding notes to workout_templates");
      await client.query(`ALTER TABLE workout_templates ADD COLUMN notes TEXT`);
    }

    // ── notes & rest_seconds on template exercises ──────────────────────────
    const { rows: hasExNotes } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_template_exercises' AND column_name='notes'`
    );
    if (hasExNotes.length === 0) {
      logger.info("Adding notes to workout_template_exercises");
      await client.query(`ALTER TABLE workout_template_exercises ADD COLUMN notes TEXT`);
    }
    const { rows: hasRestSec } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='workout_template_exercises' AND column_name='rest_seconds'`
    );
    if (hasRestSec.length === 0) {
      logger.info("Adding rest_seconds to workout_template_exercises");
      await client.query(`ALTER TABLE workout_template_exercises ADD COLUMN rest_seconds INTEGER DEFAULT 90`);
    }

    // ── progress_photos table ────────────────────────────────────────────
    const { rows: hasProgressPhotos } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'progress_photos'`
    );
    if (hasProgressPhotos.length === 0) {
      logger.info("Creating progress_photos table");
      await client.query(`
        CREATE TABLE progress_photos (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          photo_url TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'front',
          date DATE NOT NULL,
          note TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // ── water_logs table ─────────────────────────────────────────────────
    const { rows: hasWaterLogs } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'water_logs'`
    );
    if (hasWaterLogs.length === 0) {
      logger.info("Creating water_logs table");
      await client.query(`CREATE TABLE water_logs (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, glasses INTEGER NOT NULL DEFAULT 0, date DATE NOT NULL)`);
    }

    // One row per (user, day) so upserts can use ON CONFLICT and we can't end
    // up with duplicate water totals if two requests race.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'water_logs_user_id_date_unique'
        ) THEN
          DELETE FROM water_logs a USING water_logs b
            WHERE a.user_id = b.user_id AND a.date = b.date AND a.id < b.id;
          CREATE UNIQUE INDEX water_logs_user_id_date_unique
            ON water_logs(user_id, date);
        END IF;
      END $$;
    `);

    // CheckIn: enforce one row per (user, calendar day) so duplicate clicks /
    // double posts don't create multiple check-ins for the same day.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'checkin_user_day_unique'
        ) THEN
          DELETE FROM "CheckIn" a USING "CheckIn" b
            WHERE a."userId" = b."userId"
              AND date_trunc('day', a."timestamp") = date_trunc('day', b."timestamp")
              AND a.id < b.id;
          CREATE UNIQUE INDEX checkin_user_day_unique
            ON "CheckIn" ("userId", (date_trunc('day', "timestamp")));
        END IF;
      END $$;
    `);

    // ── session_ratings table ─────────────────────────────────────────────
    const { rows: hasSessionRatings } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'session_ratings'`
    );
    if (hasSessionRatings.length === 0) {
      logger.info("Creating session_ratings table");
      await client.query(`CREATE TABLE session_ratings (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, rating INTEGER NOT NULL, note TEXT, date DATE NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    }

    // ── chat_messages table ───────────────────────────────────────────────
    const { rows: hasChatMessages } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages'`
    );
    if (hasChatMessages.length === 0) {
      logger.info("Creating chat_messages table");
      await client.query(`CREATE TABLE chat_messages (id SERIAL PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, receiver_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    }

    // ── notifications table ───────────────────────────────────────────────
    const { rows: hasNotifications } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications'`
    );
    if (hasNotifications.length === 0) {
      logger.info("Creating notifications table");
      await client.query(`CREATE TABLE notifications (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT, type TEXT NOT NULL DEFAULT 'general', read INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    }

    // ── meal_plans + meal_plan_items tables ────────────────────────────────
    const { rows: hasMealPlans } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_plans'`
    );
    if (hasMealPlans.length === 0) {
      logger.info("Creating meal_plans table");
      await client.query(`CREATE TABLE meal_plans (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, name TEXT NOT NULL, notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
      logger.info("Creating meal_plan_items table");
      await client.query(`CREATE TABLE meal_plan_items (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE, meal_name TEXT NOT NULL, time TEXT, calories INTEGER, protein INTEGER, carbs INTEGER, fats INTEGER, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`);
    }

    // ── wa_templates table ────────────────────────────────────────────────
    const { rows: hasWaTemplates } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'wa_templates'`
    );
    if (hasWaTemplates.length === 0) {
      logger.info("Creating wa_templates table");
      await client.query(`CREATE TABLE wa_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
      // Seed the three legacy templates the frontend used to ship hard-coded so
      // upgrades are zero-touch for existing operators.
      await client.query(
        `INSERT INTO wa_templates (name, body, sort_order) VALUES
          ($1, $2, 0),
          ($3, $4, 1),
          ($5, $6, 2)`,
        [
          "ترحيب بعضو جديد 👋",
          "أهلاً وسهلاً {name} 🦅\nيسعدنا انضمامك لعائلة {gym_name}!\nاشتراكك فعّال حتى {end_date}.\nنتمنى لك رحلة رياضية موفقة 💪",
          "قرب انتهاء الاشتراك ⚠️",
          "مرحباً {name} 👋\nاشتراكك في {gym_name} سينتهي قريباً بتاريخ {end_date}.\nجدد الآن واستمر في رحلتك 💪",
          "تجديد الاشتراك ✅",
          "أهلاً {name} 🎉\nتم تجديد اشتراكك بنجاح!\nاشتراكك الجديد فعّال حتى {end_date}.\nأبوابنا مفتوحة لك دائماً 🦅💪",
        ]
      );
    }

    // ── User.category column ──────────────────────────────────────────────
    // Schema declares this column but a previous migration version forgot to
    // add it; without this every login 500s on databases provisioned before
    // the column was introduced.
    const { rows: hasUserCategory } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'category'`
    );
    if (hasUserCategory.length === 0) {
      logger.info("Adding category to User");
      await client.query(`ALTER TABLE "User" ADD COLUMN category TEXT NOT NULL DEFAULT 'normal'`);
    }

    // Drop legacy lowercase 'checkins' table (the active code uses "CheckIn")
    const { rows: legacyCheckins } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'checkins'`
    );
    if (legacyCheckins.length > 0) {
      logger.warn("Dropping legacy 'checkins' table (replaced by \"CheckIn\")");
      await client.query(`DROP TABLE IF EXISTS checkins CASCADE`);
    }

    // ── Seed default admin ─────────────────────────────────────────────────
    const { rows } = await client.query(
      `SELECT id FROM "User" WHERE phone = $1 LIMIT 1`,
      ["01025754947"]
    );
    if (rows.length === 0) {
      const hashed = await bcrypt.hash("admin123", 12);
      const { randomUUID } = await import("crypto");
      await client.query(
        `INSERT INTO "User" (id, name, phone, "passwordHash", role) VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), "Admin", "01025754947", hashed, "admin"]
      );
      logger.info("Default admin user created");
    }

    await client.query("COMMIT");
    logger.info("Migrations complete");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may already be aborted */
    }
    throw err;
  } finally {
    if (acquiredLock) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY.toString()]);
      } catch {
        /* connection may have errored — lock will free on release() */
      }
    }
    client.release();
  }
}
