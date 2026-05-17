/**
 * `users` repository — the only place in the app that touches `usersTable`
 * for auth-related reads/writes. Keeping these queries in one file makes
 * them easy to audit (especially after a schema change) and trivial to mock
 * in unit tests of the service layer.
 *
 * Repos return plain row shapes; they intentionally don't know about HTTP
 * status codes, audit events, or token lifetimes. The auth.service.ts on
 * top is where business decisions live.
 */
import { db } from "../db/index.js";
import { usersTable } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export type UserRow = typeof usersTable.$inferSelect;

export async function findUserByPhone(phone: string): Promise<UserRow | undefined> {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  return u;
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return u;
}

export async function getFailedLoginCount(userId: string): Promise<number> {
  const [u] = await db
    .select({ failed: usersTable.failedLoginAttempts })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return u?.failed ?? 0;
}

export async function setFailedLoginAttempts(
  userId: string,
  attempts: number,
  lockedUntil: Date | null,
): Promise<void> {
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: attempts, lockedUntil })
    .where(eq(usersTable.id, userId));
}

export async function clearFailedLoginAttempts(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, userId));
}

export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
}

export async function setPhone(userId: string, phone: string): Promise<void> {
  await db.update(usersTable).set({ phone }).where(eq(usersTable.id, userId));
}

/** Returns the matching user only if it's a *different* row than `userId`. */
export async function findOtherUserWithPhone(
  phone: string,
  userId: string,
): Promise<{ id: string } | undefined> {
  const [u] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);
  if (!u || u.id === userId) return undefined;
  return u;
}

export async function setTotpSecret(userId: string, secret: string): Promise<void> {
  await db.update(usersTable).set({ totpSecret: secret }).where(eq(usersTable.id, userId));
}

export async function setTotpEnabled(userId: string, enabled: boolean): Promise<void> {
  await db
    .update(usersTable)
    .set({ totpEnabled: enabled, ...(enabled ? {} : { totpSecret: null }) })
    .where(eq(usersTable.id, userId));
}
