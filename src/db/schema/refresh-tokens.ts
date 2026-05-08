import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
