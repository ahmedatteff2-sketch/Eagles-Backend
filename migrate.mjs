import pg from "pg";
const { Client } = pg;

const c = new Client(process.env.DATABASE_URL);
await c.connect();

await c.query(`
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'normal';
`);
console.log("Added category column");

await c.query(`
  CREATE TABLE IF NOT EXISTS coach_notes (
    id serial PRIMARY KEY,
    user_id text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    note text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  );
`);
console.log("Created coach_notes table");

await c.end();
console.log("Migration done!");
