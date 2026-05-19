/**
 * `refresh_tokens` repository — opaque-token storage backing the JWT
 * refresh flow. Tokens are stored as SHA-256 hashes (never plaintext).
 *
 * The repo deliberately does NOT do any of the rotation-policy logic
 * (issuing the new pair, deciding when to revoke-everything, etc.); that's
 * in `auth.service.ts`. Keeping the persistence layer dumb makes it easy to
 * verify the queries against the DB schema in isolation.
 */
import { db } from "../db/index.js";
import { refreshTokensTable } from "../db/schema/index.js";
import { eq, and, lt } from "drizzle-orm";

export type RefreshTokenRow = typeof refreshTokensTable.$inferSelect;

export interface InsertRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
  label: string | null;
  lastUsedAt: Date;
}

export async function insertRefreshToken(input: InsertRefreshTokenInput): Promise<void> {
  await db.insert(refreshTokensTable).values(input);
}

export async function findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function revokeByHash(tokenHash: string): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revoked: true })
    .where(eq(refreshTokensTable.tokenHash, tokenHash));
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.userId, userId));
}

/**
 * Drop expired rows for a single user. We do this opportunistically on every
 * token issuance instead of a periodic cleanup job — the per-user delete is
 * tiny, and on quiet accounts there's nothing to clean anyway.
 */
export async function deleteExpiredForUser(userId: string): Promise<void> {
  await db
    .delete(refreshTokensTable)
    .where(and(eq(refreshTokensTable.userId, userId), lt(refreshTokensTable.expiresAt, new Date())));
}
