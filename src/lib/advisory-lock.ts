import { pool } from "../db/index.js";
import { logger } from "./logger.js";

/**
 * Postgres advisory locks — used to ensure background jobs run on at most
 * ONE instance at a time when the app is deployed to multiple replicas.
 *
 * `pg_try_advisory_lock(key)` returns true if it acquired the lock and false
 * if another session already holds it. The lock is automatically released
 * when the holding session disconnects, so a crashed instance doesn't block
 * other replicas indefinitely.
 *
 * Each job picks its own stable bigint key derived from the job name. We
 * reserve keys outside the migration namespace so a long migration can't
 * collide with hourly cron runs.
 */

/**
 * `withAdvisoryLock` runs `fn` only if we successfully acquire the named
 * lock. Returns:
 *   - `{ acquired: true, result }` on success
 *   - `{ acquired: false }` if another instance already holds the lock
 *
 * The lock is released in a `finally` so a thrown handler never strands it.
 */
export async function withAdvisoryLock<T>(
  key: bigint,
  fn: () => Promise<T>,
): Promise<{ acquired: true; result: T } | { acquired: false }> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1)",
      [key.toString()],
    );
    const ok = rows[0]?.pg_try_advisory_lock === true;
    if (!ok) {
      return { acquired: false };
    }
    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      // Best-effort unlock. If it fails (e.g. the connection was killed
      // mid-flight), Postgres will release the lock when the client drops
      // anyway, so we just log and continue.
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [key.toString()]);
      } catch (err) {
        logger.warn({ err, key: key.toString() }, "Failed to release advisory lock — will be released on disconnect");
      }
    }
  } finally {
    client.release();
  }
}

// Stable lock keys — pick large unique bigints so they don't collide with
// the migration lock (0x4541474c45534d49n) or any other lock the app uses.
// Derivation: ASCII of "ren_remind" / "abs_remind" packed into bigints.
export const RENEWAL_REMINDER_LOCK_KEY = 0x52454e5f52454d44n;
export const ABSENCE_REMINDER_LOCK_KEY = 0x4142535f52454d44n;
