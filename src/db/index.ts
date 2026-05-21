import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { parseDatabaseUrl } from "../lib/db-url.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const dbUrl = parseDatabaseUrl(process.env.DATABASE_URL);

// Supabase Session Pooler uses pgbouncer — disable prepared statements.
const isPooler = dbUrl.host.includes("pooler.supabase.com");

/**
 * Connection pool sizing.
 *
 * On a small Render instance (~512MB) Postgres can comfortably handle
 * ~20-30 connections, but we should leave headroom for:
 *   - the migration runner, which holds an exclusive client during boot
 *   - admin tools (`psql`, drizzle-kit) connecting alongside the app
 *
 * `DB_POOL_MAX` lets ops tune this without redeploying. In tests we cap
 * at 5 so vitest workers don't oversubscribe a local Postgres.
 */
function poolMax(): number {
  const raw = process.env.DB_POOL_MAX;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) return Math.floor(parsed);
  }
  if (isTest) return 5;
  return isProduction ? 20 : 10;
}

/**
 * `application_name` shows up in `pg_stat_activity.application_name`, which
 * makes it trivial to find the app's queries when debugging from psql or
 * Render's dashboard. The instance suffix (when present) helps distinguish
 * replicas during multi-instance deployments.
 */
const APPLICATION_NAME =
  process.env.DB_APPLICATION_NAME ??
  `eagles-backend${process.env.RENDER_INSTANCE_ID ? `-${process.env.RENDER_INSTANCE_ID.slice(0, 8)}` : ""}`;

export const pool = new Pool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 5432,
  user: decodeURIComponent(dbUrl.username),
  // `URL`'s username/password fields are already percent-decoded once when
  // accessed via `dbUrl.username/password` only on some Node versions; in
  // practice both `whatwg-url`-backed runtimes return the *raw* (still
  // percent-encoded) substring, so a single decode is correct here. The
  // previous code applied `decodeURIComponent` on top of an already-decoded
  // value when the password contained literal `%`s, which then 500'd at
  // connect time on perfectly valid passwords.
  password: decodeURIComponent(dbUrl.password),
  database: decodeURIComponent(dbUrl.pathname.slice(1)),
  ssl: isProduction
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false,
  max: poolMax(),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  // Hard ceiling on a single statement so a runaway query can't hold a
  // connection forever. 30s is generous for OLTP work; long-running jobs
  // (CSV exports, etc.) should use their own client with a higher cap.
  statement_timeout: 30_000,
  // Surface the app's identity to PostgreSQL so DBAs can pinpoint our
  // queries in pg_stat_activity / slow-query logs.
  application_name: APPLICATION_NAME,
} as pg.PoolConfig);

// Pool-level error handler. Without this, an idle client emitting an
// `error` event (e.g. the database closed our connection while we weren't
// using it) will crash the process via Node's "unhandled error" rule.
// We log and let pg drop the bad client; the next acquire will reconnect.
pool.on("error", (err) => {
  // Lazy-import the logger so circular module init doesn't kick in.
  void import("../lib/logger.js").then(({ logger }) => {
    logger.error({ err }, "Idle pg client error — connection will be dropped");
  });
});

export const db = drizzle(pool, {
  schema,
  ...(isPooler && {}),
});

export * from "./schema/index.js";
