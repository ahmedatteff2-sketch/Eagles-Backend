import { pgTable, serial, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

/**
 * Quick-notes that a trainer attaches to one of their assigned members.
 *
 * Distinct from `coach_notes` (which is a member-facing one-way feed where
 * the admin/coach writes longer prescriptions) — this table is the trainer's
 * private notebook: short observations they want to remember next session
 * without polluting the member's inbox.
 *
 * Categories are deliberately a small fixed vocabulary so the dashboard can
 * filter by them; we use a TEXT column rather than an enum to avoid the
 * `ALTER TYPE ... ADD VALUE` ceremony when product wants to add one.
 */
export const trainerMemberNotesTable = pgTable(
  "trainer_member_notes",
  {
    id: serial("id").primaryKey(),
    // The trainer who wrote the note. ON DELETE SET NULL so deleting a
    // trainer row keeps the notes around for audit / handover, just unowned.
    trainerId: text("trainer_id").references(() => usersTable.id, { onDelete: "set null" }),
    // The member the note is about. ON DELETE CASCADE — once the member is
    // gone, their notes have no reason to stick around.
    memberId: text("member_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    // Free-text body. Capped at 2000 chars at the API layer; the column is
    // TEXT (no DB-level limit) so a future bump doesn't need a migration.
    note: text("note").notNull(),
    // Tag for the dashboard's category filter. Validated at the API layer
    // via Zod; "general" is the catch-all default.
    category: text("category").notNull().default("general"),
    // Pinned notes float to the top of the member profile page. Lets the
    // trainer flag "this person has a knee injury — adjust squats" so it's
    // never out of sight.
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // Hot path: load all notes for one member, ordered by recency. Without
    // this index the trainer profile page would seq-scan once the table
    // grows past a few thousand notes.
    byMember: index("trainer_member_notes_member_id_idx").on(t.memberId),
    // Secondary path: trainer dashboard filters by trainer (their notes only).
    byTrainer: index("trainer_member_notes_trainer_id_idx").on(t.trainerId),
  }),
);

export const insertTrainerMemberNoteSchema = createInsertSchema(trainerMemberNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrainerMemberNote = z.infer<typeof insertTrainerMemberNoteSchema>;
export type TrainerMemberNote = typeof trainerMemberNotesTable.$inferSelect;

/**
 * Allowed values for the `category` column. Kept here (not in the route) so
 * other layers — services, repositories, the seed script — share one source
 * of truth.
 */
export const TRAINER_NOTE_CATEGORIES = ["general", "form", "nutrition", "behavior", "injury"] as const;
export type TrainerNoteCategory = (typeof TRAINER_NOTE_CATEGORIES)[number];
