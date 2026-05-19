import { pgTable, text, timestamp, integer, boolean, pgEnum, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "trainer", "member"]);

export const usersTable = pgTable("User", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  membershipNumber: text("membershipNumber").unique(),
  passwordHash: text("passwordHash").notNull(),
  role: text("role").notNull().default("member"),
  category: text("category").notNull().default("normal"),
  // Optional trainer assignment for member users (NULL for non-members or
  // members not yet assigned to a trainer). Self-reference: points to another
  // row in the same table whose role is "trainer". `ON DELETE SET NULL` so
  // deleting a trainer row doesn't cascade-delete their members.
  assignedTrainerId: text("assignedTrainerId").references((): AnyPgColumn => usersTable.id, {
    onDelete: "set null",
  }),
  // Account lockout / brute-force protection. Both fields are best-effort
  // hints; the source of truth for "is this account locked right now" is
  // `lockedUntil > now()`. `failedLoginAttempts` is reset to 0 on every
  // successful login and on every successful 2FA verification.
  failedLoginAttempts: integer("failedLoginAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  // TOTP / 2FA. `totpSecret` is the base32-encoded shared secret; it MUST be
  // wiped (set NULL) when 2FA is disabled. `totpEnabled` toggles whether the
  // login flow asks for a code.
  totpSecret: text("totpSecret"),
  totpEnabled: boolean("totpEnabled").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
