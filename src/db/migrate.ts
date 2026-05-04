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

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");

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

      CREATE TABLE IF NOT EXISTS training_programs (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        user_id    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS training_weeks (
        id           SERIAL PRIMARY KEY,
        program_id   INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        week_number  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        video_url      TEXT,
        sets_required  INTEGER NOT NULL DEFAULT 3,
        reps_min       INTEGER NOT NULL,
        reps_max       INTEGER NOT NULL,
        week_id        INTEGER NOT NULL REFERENCES training_weeks(id) ON DELETE CASCADE
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
