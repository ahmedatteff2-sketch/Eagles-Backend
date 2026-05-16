import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/**
 * Audit-trail of "you've been absent" WhatsApp reminders. One row per send —
 * either an admin click in the AbsentMembers page (`channel='whatsapp'`) or a
 * background-pass marker dropped by the hourly job (`channel='system'`).
 *
 * Used to:
 *   1. Dedupe — don't ping the same member twice within ~23h
 *   2. Show "last contacted" in the absent-members queue
 *   3. Provide an audit log for "did we already reach out?"
 */
export const absenceRemindersTable = pgTable("absence_reminders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // "whatsapp" = the admin opened a wa.me link in the UI
  // "system"   = the cron noticed the member hadn't checked in for ≥N days
  channel: text("channel").notNull().default("whatsapp"),
  sentBy: text("sent_by").references(() => usersTable.id, { onDelete: "set null" }),
  success: boolean("success").notNull().default(true),
  note: text("note"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type AbsenceReminder = typeof absenceRemindersTable.$inferSelect;
