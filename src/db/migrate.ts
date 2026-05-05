import { pool } from "./index.js";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger.js";

/**
 * Idempotent bootstrap migration that aligns the database with the Drizzle
 * schema in `src/db/schema/*`. Only creates objects that don't already exist
 * so it's safe to run on every boot. For schema changes, use `drizzle-kit
 * generate` + `drizzle-kit migrate` (see package.json scripts).
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");

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
        token      TEXT NOT NULL UNIQUE,
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
          token      TEXT NOT NULL UNIQUE,
          revoked    BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL
        )
      `);
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
      const hashed = await bcrypt.hash("admin123", 10);
      const { randomUUID } = await import("crypto");
      await client.query(
        `INSERT INTO "User" (id, name, phone, "passwordHash", role) VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), "Admin", "01025754947", hashed, "admin"]
      );
      logger.info("Default admin user created");
    }

    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}
