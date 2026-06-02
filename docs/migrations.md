# Database migrations

The app supports two migration paths. Pick **one** policy per environment and
stick with it.

## 1. Bootstrap migration (current default)

`src/db/migrate.ts` runs at every server boot. It is fully idempotent and uses
`pg_advisory_lock` so multi-instance deployments cannot race on DDL. This is the
path used by `npm run dev` and the production `node dist/index.mjs` startup.

**Pros:** zero ops overhead — push the code, the schema follows.
**Cons:** no audit trail of when each change happened, harder to roll back, and
makes long-running changes (e.g. backfilling a column) coupled to deploy timing.

## 2. drizzle-kit migrations (recommended for production hardening)

For schemas that change frequently in production, generate explicit SQL files
checked into git:

```bash
# 1. Edit src/db/schema/*.ts
# 2. Generate the next migration (writes drizzle/<timestamp>_<name>.sql)
npm run db:generate

# 3. Apply on the target database (locally or on Render via shell)
DATABASE_URL=... npm run db:migrate
```

`drizzle/meta/` is committed so subsequent `db:generate` runs produce
incremental diffs rather than re-emitting the whole schema.

### Migration order

1. Generate the migration locally and commit it.
2. Deploy the code (the runtime bootstrap in `migrate.ts` is idempotent — it
   will no-op if `db:migrate` has already created the objects).
3. Run `npm run db:migrate` on the target DB if you need the migration to be
   tracked in `__drizzle_migrations` (e.g. for ops audits).

### Why both paths exist

The bootstrap script doubles as a **legacy-schema healer**: it renames
`User.password` → `passwordHash`, fixes integer-vs-text user-id columns left
over from prior versions, etc. Those steps are too dynamic for static SQL
files. Once a deployment has stabilized on the current schema, you can switch
to `drizzle-kit` exclusively by setting `SKIP_BOOTSTRAP_MIGRATIONS=1` in the
environment (the bootstrap module respects it as a no-op flag).
