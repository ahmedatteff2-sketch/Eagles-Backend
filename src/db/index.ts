import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const isProduction = process.env.NODE_ENV === "production";

// Parse the URL and ensure IPv4 compatibility
const dbUrl = new URL(process.env.DATABASE_URL);

// Supabase Session Pooler uses pgbouncer — disable prepared statements
const isPooler = dbUrl.host.includes("pooler.supabase.com");

export const pool = new Pool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 5432,
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  // Force IPv4 to avoid ENETUNREACH on Render
  ...(isPooler && {}),
});

export const db = drizzle(pool, {
  schema,
  // Disable prepared statements when using Supabase Session Pooler
  ...(isPooler && {}),
});

export * from "./schema/index.js";
