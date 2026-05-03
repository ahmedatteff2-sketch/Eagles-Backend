import { pool } from "./index.js";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger.js";

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        phone       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        role        role NOT NULL DEFAULT 'member',
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        duration  INTEGER NOT NULL,
        price     NUMERIC(10,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS member_subscriptions (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        status          subscription_status NOT NULL DEFAULT 'active',
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS training_programs (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        set_number  INTEGER NOT NULL,
        reps        INTEGER NOT NULL,
        weight      NUMERIC(6,2) NOT NULL,
        date        DATE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS body_stats (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date              DATE NOT NULL,
        weight            NUMERIC(6,2),
        body_fat          NUMERIC(5,2),
        diet_note         TEXT,
        performance_note  TEXT
      );

      CREATE TABLE IF NOT EXISTS checkins (
        id       SERIAL PRIMARY KEY,
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date     DATE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id       SERIAL PRIMARY KEY,
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount   NUMERIC(10,2) NOT NULL,
        date     DATE NOT NULL,
        method   payment_method NOT NULL DEFAULT 'cash'
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    `);

    // ── Seed default admin ─────────────────────────────────────────────────
    const { rows } = await client.query(
      "SELECT id FROM users WHERE phone = $1 LIMIT 1",
      ["01025754947"]
    );
    if (rows.length === 0) {
      const hashed = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO users (name, phone, password, role) VALUES ($1, $2, $3, $4)",
        ["Admin", "01025754947", hashed, "admin"]
      );
      logger.info("Default admin user created");
    }

    logger.info("Migrations complete");
  } finally {
    client.release();
  }
}
