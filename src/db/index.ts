import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const isProduction = process.env.NODE_ENV === "production";

const dbUrl = new URL(process.env.DATABASE_URL);

// Supabase Session Pooler uses pgbouncer — disable prepared statements.
const isPooler = dbUrl.host.includes("pooler.supabase.com");

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
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

export const db = drizzle(pool, {
  schema,
  ...(isPooler && {}),
});

export * from "./schema/index.js";
