/**
 * Test data factories. Tests should never insert directly via raw SQL — go
 * through these so the seeded data stays consistent with the runtime schema.
 */
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "../../src/db/index.js";
import { usersTable } from "../../src/db/schema/index.js";

export interface SeededUser {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: "admin" | "trainer" | "member";
}

export interface CreateUserInput {
  phone?: string;
  password?: string;
  role?: SeededUser["role"];
  name?: string;
}

/**
 * Insert a fresh user with a known plaintext password we can pass straight
 * to /auth/login. Returns the plaintext alongside the row so the test
 * doesn't have to remember it separately.
 */
export async function createTestUser(input: CreateUserInput = {}): Promise<SeededUser> {
  const password = input.password ?? "test_password_123";
  // Lower bcrypt cost in tests — 4 is enough for the format check, 12 makes
  // every login test ~300ms slower for no real benefit.
  const passwordHash = await bcrypt.hash(password, 4);
  const id = randomUUID();
  const phone = input.phone ?? `0100${Math.floor(1000000 + Math.random() * 9000000)}`;
  const name = input.name ?? "Test User";
  const role = input.role ?? "member";

  await db.insert(usersTable).values({
    id,
    name,
    phone,
    passwordHash,
    role,
  });

  return { id, name, phone, password, role };
}
