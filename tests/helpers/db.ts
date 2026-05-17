/**
 * Test DB helpers. Each suite that touches the database calls `setupTestDb`
 * which (a) ensures migrations have run and (b) resets the rows touched by
 * the suite. We don't drop/recreate the schema between tests because
 * migrations are idempotent and reasonably fast — but we do truncate the
 * tables involved in auth flows so tests can assume a clean slate.
 */
import { pool, db } from "../../src/db/index.js";
import { runMigrations } from "../../src/db/migrate.js";

let migrated = false;

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  await runMigrations();
  migrated = true;
}

/**
 * Truncate every table touched by auth/session tests. Order matters because
 * of FK cascades; we do the leaf tables first then "User" last.
 */
export async function resetAuthTables(): Promise<void> {
  // CASCADE truncates handle the rest of the FK graph in one statement.
  await pool.query(`TRUNCATE TABLE refresh_tokens, audit_logs, "User" RESTART IDENTITY CASCADE`);
}

export { db, pool };
