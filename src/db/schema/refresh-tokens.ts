import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  revoked: boolean("revoked").notNull().default(false),
  // Best-effort device/session metadata captured at issuance time. Used by the
  // /api/auth/sessions endpoint so users can review where they're signed in
  // and revoke specific sessions remotely.
  userAgent: text("user_agent"),
  ip: text("ip"),
  label: text("label"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
