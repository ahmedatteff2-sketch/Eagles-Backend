/**
 * Import a legacy gym-management SQLite backup (members, packages, payments,
 * checkins) into the current PostgreSQL schema.
 *
 * The legacy schema looks like this (Arabic-language gym backup):
 *   members(id, full_name, phone, package_id, start_date, duration_days,
 *           expiry_date, status, notes, created_at, updated_at)
 *   packages(id, name, name_ar, price, duration_days, ...)
 *   payments(id, member_id, amount, package_id, payment_date,
 *            payment_method, notes, created_at)
 *   checkins(id, member_id, checkin_time)
 *   users(id, username, password_hash, created_at)            -- skipped
 *   settings(key, value)                                       -- skipped
 *
 * Each legacy member becomes a User row (role=member, default password
 * "123456", legacy id stored in membershipNumber so it can be looked up
 * later) plus a member_subscriptions row pointing at the matching
 * subscription. Payments and check-ins are remapped onto the new user IDs.
 *
 * Usage:
 *   tsx scripts/import-sqlite-backup.ts <path-to-backup.db> [--reset]
 *     [--default-password=PASS] [--dry-run]
 *
 * Flags:
 *   --reset            Delete every existing role=member User (cascade
 *                      removes their subscriptions/payments/check-ins) before
 *                      inserting the legacy data. Without this the script
 *                      will skip members whose phone already exists.
 *   --default-password Password to set for every imported member (default
 *                      "123456" — matches /imports/members/sqlite).
 *   --dry-run          Print the per-table summary that *would* be inserted
 *                      without writing anything.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { pool } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";

const BCRYPT_COST = 12;
const DEFAULT_PASSWORD = "123456";

interface Args {
  filePath: string;
  reset: boolean;
  dryRun: boolean;
  defaultPassword: string;
}

function parseArgs(argv: string[]): Args {
  let filePath: string | undefined;
  let reset = false;
  let dryRun = false;
  let defaultPassword = DEFAULT_PASSWORD;

  for (const arg of argv) {
    if (arg === "--reset") {
      reset = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--default-password=")) {
      defaultPassword = arg.slice("--default-password=".length);
    } else if (!arg.startsWith("--")) {
      filePath = arg;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (!filePath) {
    throw new Error(
      "Usage: tsx scripts/import-sqlite-backup.ts <path-to-backup.db> [--reset] [--default-password=PASS] [--dry-run]",
    );
  }

  return { filePath: path.resolve(filePath), reset, dryRun, defaultPassword };
}

interface LegacyPackage {
  id: number;
  name: string;
  name_ar: string | null;
  price: number;
  duration_days: number;
}

interface LegacyMember {
  id: number;
  full_name: string;
  phone: string | null;
  package_id: number | null;
  start_date: string;
  duration_days: number;
  expiry_date: string;
  status: string | null;
  notes: string | null;
}

interface LegacyPayment {
  id: number;
  member_id: number | null;
  amount: number;
  package_id: number | null;
  payment_date: string;
  payment_method: string | null;
}

interface LegacyCheckin {
  id: number;
  member_id: number | null;
  checkin_time: string;
}

const VALID_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);

function normalizeStatus(raw: string | null): "active" | "expired" {
  // Legacy schema uses 'active' | 'expiring' | 'expired'. The PG enum only
  // has 'active' and 'expired' — treat 'expiring' as still active.
  if (raw === "expired") return "expired";
  return "active";
}

function normalizeMethod(raw: string | null): "cash" | "card" | "transfer" {
  const m = (raw ?? "cash").toLowerCase();
  return VALID_PAYMENT_METHODS.has(m) ? (m as "cash" | "card" | "transfer") : "cash";
}

function normalizeDate(raw: string): string {
  // Legacy values look like "2026-04-01" or "2026-04-16 18:13:38". The PG
  // `date` columns want plain YYYY-MM-DD.
  return raw.slice(0, 10);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const sqlite = new Database(args.filePath, { readonly: true, fileMustExist: true });
  const tableNames = sqlite
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((r) => r.name);

  for (const required of ["members", "packages", "payments"]) {
    if (!tableNames.includes(required)) {
      sqlite.close();
      throw new Error(
        `Backup is missing required table "${required}". Found: ${tableNames.join(", ") || "(none)"}`,
      );
    }
  }
  const hasCheckins = tableNames.includes("checkins");

  const packages = sqlite
    .prepare<[], LegacyPackage>("SELECT * FROM packages ORDER BY id")
    .all();
  const members = sqlite
    .prepare<[], LegacyMember>("SELECT * FROM members ORDER BY id")
    .all();
  const payments = sqlite
    .prepare<[], LegacyPayment>("SELECT * FROM payments ORDER BY id")
    .all();
  const checkins = hasCheckins
    ? sqlite
        .prepare<[], LegacyCheckin>("SELECT * FROM checkins ORDER BY id")
        .all()
    : [];

  sqlite.close();

  logger.info(
    {
      packages: packages.length,
      members: members.length,
      payments: payments.length,
      checkins: checkins.length,
      reset: args.reset,
      dryRun: args.dryRun,
    },
    "SQLite backup loaded",
  );

  // Pre-hash the default password once — bcrypt is the slow part of the
  // import and every imported member shares the same default password.
  const defaultPasswordHash = await bcrypt.hash(args.defaultPassword, BCRYPT_COST);

  if (args.dryRun) {
    logger.info(
      "Dry run — not writing anything. Re-run without --dry-run to commit.",
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  const subscriptionIdByLegacy = new Map<number, number>();
  const userIdByLegacy = new Map<number, string>();
  const stats = {
    subscriptionsCreated: 0,
    subscriptionsReused: 0,
    membersCreated: 0,
    membersSkipped: 0,
    memberSubscriptionsCreated: 0,
    paymentsCreated: 0,
    paymentsSkipped: 0,
    checkinsCreated: 0,
    checkinsSkipped: 0,
    errors: [] as string[],
  };

  try {
    await client.query("BEGIN");

    if (args.reset) {
      // Members first (cascade kills their member_subscriptions, payments,
      // CheckIns, exercise_logs, body_stats, etc). Admins and trainers are
      // preserved so the operator can still log in.
      const deletedMembers = await client.query(
        `DELETE FROM "User" WHERE role = 'member'`,
      );
      // Subscriptions/packages — no FK cascade from User, so wipe explicitly
      // now that nothing references them. Restart the SERIAL so freshly
      // imported packages get their numbers from 1.
      const deletedSubs = await client.query(
        `TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE`,
      );
      logger.warn(
        {
          deletedMembers: deletedMembers.rowCount,
          truncatedSubscriptions: deletedSubs.command,
        },
        "--reset wiped existing members and subscriptions",
      );
    }

    // ── packages → subscriptions (match by name, otherwise insert) ─────────
    for (const pkg of packages) {
      const subName = pkg.name_ar?.trim() || pkg.name.trim();
      const duration = Number(pkg.duration_days) || 30;
      const price = Number(pkg.price) || 0;

      const { rows: existing } = await client.query<{ id: number }>(
        `SELECT id FROM subscriptions WHERE name = $1 LIMIT 1`,
        [subName],
      );
      if (existing.length > 0) {
        subscriptionIdByLegacy.set(pkg.id, existing[0]!.id);
        stats.subscriptionsReused++;
        continue;
      }

      const { rows: inserted } = await client.query<{ id: number }>(
        `INSERT INTO subscriptions (name, duration, price)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [subName, duration, price.toFixed(2)],
      );
      subscriptionIdByLegacy.set(pkg.id, inserted[0]!.id);
      stats.subscriptionsCreated++;
    }

    // ── members → User (+ membership_number = legacy id) + member_subscriptions ─
    for (const m of members) {
      const name = m.full_name?.trim();
      const phone = normalizePhone((m.phone ?? "").trim());

      if (!name || !phone) {
        stats.membersSkipped++;
        stats.errors.push(
          `Member id=${m.id} skipped: missing name="${name}" or phone="${m.phone}"`,
        );
        continue;
      }

      const membershipNumber = String(m.id);

      // If --reset wasn't passed, fall back to lookup-by-phone so the script
      // is idempotent on partial re-runs.
      const { rows: byPhone } = await client.query<{ id: string }>(
        `SELECT id FROM "User" WHERE phone = $1 LIMIT 1`,
        [phone],
      );
      let userId: string;
      if (byPhone.length > 0) {
        userId = byPhone[0]!.id;
        stats.membersSkipped++;
      } else {
        userId = randomUUID();
        // membershipNumber is UNIQUE — if a previous partial run already
        // grabbed this number for a different phone, fall back to NULL.
        const { rows: byMembership } = await client.query<{ id: string }>(
          `SELECT id FROM "User" WHERE "membershipNumber" = $1 LIMIT 1`,
          [membershipNumber],
        );
        const membershipForInsert =
          byMembership.length === 0 ? membershipNumber : null;

        await client.query(
          `INSERT INTO "User" (id, name, phone, "membershipNumber",
                               "passwordHash", role, category)
           VALUES ($1, $2, $3, $4, $5, 'member', 'normal')`,
          [userId, name, phone, membershipForInsert, defaultPasswordHash],
        );
        stats.membersCreated++;
      }
      userIdByLegacy.set(m.id, userId);

      // Always (re)attach a subscription row for the legacy member record so
      // the dashboard's "active subscription" widget has data to show.
      const subscriptionId = m.package_id
        ? subscriptionIdByLegacy.get(m.package_id)
        : undefined;
      if (subscriptionId !== undefined) {
        const startDate = normalizeDate(m.start_date);
        const endDate = normalizeDate(m.expiry_date);
        const { rows: existingSub } = await client.query(
          `SELECT id FROM member_subscriptions
           WHERE user_id = $1 AND subscription_id = $2
             AND start_date = $3 AND end_date = $4
           LIMIT 1`,
          [userId, subscriptionId, startDate, endDate],
        );
        if (existingSub.length === 0) {
          await client.query(
            `INSERT INTO member_subscriptions
               (user_id, subscription_id, start_date, end_date, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              subscriptionId,
              startDate,
              endDate,
              normalizeStatus(m.status),
            ],
          );
          stats.memberSubscriptionsCreated++;
        }
      }
    }

    // ── payments ───────────────────────────────────────────────────────────
    for (const p of payments) {
      if (p.member_id == null) {
        stats.paymentsSkipped++;
        stats.errors.push(`Payment id=${p.id} skipped: no member_id`);
        continue;
      }
      const userId = userIdByLegacy.get(p.member_id);
      if (!userId) {
        stats.paymentsSkipped++;
        stats.errors.push(
          `Payment id=${p.id} skipped: legacy member_id=${p.member_id} was not imported`,
        );
        continue;
      }
      await client.query(
        `INSERT INTO payments (user_id, amount, date, method)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          Number(p.amount).toFixed(2),
          normalizeDate(p.payment_date),
          normalizeMethod(p.payment_method),
        ],
      );
      stats.paymentsCreated++;
    }

    // ── checkins → "CheckIn" ───────────────────────────────────────────────
    for (const c of checkins) {
      if (c.member_id == null) {
        stats.checkinsSkipped++;
        continue;
      }
      const userId = userIdByLegacy.get(c.member_id);
      if (!userId) {
        stats.checkinsSkipped++;
        stats.errors.push(
          `Check-in id=${c.id} skipped: legacy member_id=${c.member_id} was not imported`,
        );
        continue;
      }
      // ON CONFLICT keeps the script idempotent against the (userId, day)
      // unique index installed by `runMigrations`.
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO "CheckIn" (id, "userId", "timestamp", "method")
         VALUES ($1, $2, $3, 'MANUAL')
         ON CONFLICT ("userId", (date_trunc('day', "timestamp"))) DO NOTHING
         RETURNING id`,
        [randomUUID(), userId, c.checkin_time],
      );
      if (inserted.rowCount && inserted.rowCount > 0) {
        stats.checkinsCreated++;
      } else {
        stats.checkinsSkipped++;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore — connection may already be aborted */
    }
    throw err;
  } finally {
    client.release();
  }

  logger.info(stats, "Import complete");
  if (stats.errors.length > 0) {
    logger.warn({ count: stats.errors.length }, "Import warnings");
    for (const e of stats.errors) logger.warn(e);
  }

  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "Import failed");
  process.exitCode = 1;
  void pool.end();
});
