/**
 * Global test setup. Runs once per worker before any test file. We keep this
 * minimal — most setup is per-suite (see helpers/db.ts) so individual test
 * files document their own preconditions.
 */
import { afterAll } from "vitest";

// Disable background jobs so the suite doesn't race against scheduled timers.
// This must be set BEFORE any code that reads the env (db/index.ts, jobs/*).
process.env.RENEWAL_REMINDERS_DISABLED = "1";
process.env.ABSENCE_REMINDERS_DISABLED = "1";

// Make sure tests fail fast if someone forgets to provide a DATABASE_URL.
// The suite uses a real Postgres (CI provides one as a service container);
// see docs/migrations.md for how to wire a local DB.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set for tests. In CI it's wired by the workflow; locally see README.",
  );
}

// Lazy-import so the env-var check above runs first (db/index.ts also
// validates DATABASE_URL on import).
const { pool } = await import("../src/db/index.js");

afterAll(async () => {
  // Close the shared pg pool so vitest can exit cleanly.
  await pool.end().catch(() => {
    /* already closed */
  });
});
