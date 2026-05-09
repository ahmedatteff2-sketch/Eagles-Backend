import { pgTable, serial, integer, text, date, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";
import { subscriptionsTable } from "./subscriptions.js";

export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expired", "frozen"]);

export const memberSubscriptionsTable = pgTable("member_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  // Freeze support: when an admin freezes a subscription we record `frozenAt`
  // (NULL → not frozen). On unfreeze we extend `endDate` by the number of days
  // the sub was frozen and accumulate the total in `totalFrozenDays` for
  // reporting / abuse prevention.
  frozenAt: timestamp("frozen_at"),
  totalFrozenDays: integer("total_frozen_days").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMemberSubscriptionSchema = createInsertSchema(memberSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertMemberSubscription = z.infer<typeof insertMemberSubscriptionSchema>;
export type MemberSubscription = typeof memberSubscriptionsTable.$inferSelect;
