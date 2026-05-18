/**
 * `trainer_member_notes` repository — pure persistence layer for the quick
 * notes a trainer attaches to one of their members. All authorization
 * (i.e. "can THIS trainer write a note about THIS member?") is enforced in
 * the service layer; the repo just runs queries.
 */
import { db } from "../db/index.js";
import { trainerMemberNotesTable } from "../db/schema/index.js";
import { and, desc, eq } from "drizzle-orm";

export type TrainerNoteRow = typeof trainerMemberNotesTable.$inferSelect;

export interface CreateNoteInput {
  trainerId: string;
  memberId: string;
  note: string;
  category: string;
  pinned?: boolean;
}

export async function createNote(input: CreateNoteInput): Promise<TrainerNoteRow> {
  const [row] = await db
    .insert(trainerMemberNotesTable)
    .values({
      trainerId: input.trainerId,
      memberId: input.memberId,
      note: input.note,
      category: input.category,
      pinned: input.pinned ?? false,
    })
    .returning();
  return row;
}

export interface UpdateNoteInput {
  note?: string;
  category?: string;
  pinned?: boolean;
}

export async function updateNote(noteId: number, patch: UpdateNoteInput): Promise<TrainerNoteRow | undefined> {
  const [row] = await db
    .update(trainerMemberNotesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(trainerMemberNotesTable.id, noteId))
    .returning();
  return row;
}

export async function deleteNote(noteId: number): Promise<void> {
  await db.delete(trainerMemberNotesTable).where(eq(trainerMemberNotesTable.id, noteId));
}

export async function findNoteById(noteId: number): Promise<TrainerNoteRow | undefined> {
  const [row] = await db
    .select()
    .from(trainerMemberNotesTable)
    .where(eq(trainerMemberNotesTable.id, noteId))
    .limit(1);
  return row;
}

/**
 * List every note for a single member, pinned first then most recent. The
 * trainer profile page calls this; the dashboard's "recent notes" feed uses
 * `listRecentByTrainer` instead.
 */
export async function listByMember(memberId: string): Promise<TrainerNoteRow[]> {
  return db
    .select()
    .from(trainerMemberNotesTable)
    .where(eq(trainerMemberNotesTable.memberId, memberId))
    .orderBy(desc(trainerMemberNotesTable.pinned), desc(trainerMemberNotesTable.createdAt));
}

/**
 * Recent notes the trainer wrote across ALL their members — the activity
 * feed on the trainer dashboard. Capped at `limit` so the response stays
 * small even after years of use.
 */
export async function listRecentByTrainer(trainerId: string, limit = 20): Promise<TrainerNoteRow[]> {
  return db
    .select()
    .from(trainerMemberNotesTable)
    .where(eq(trainerMemberNotesTable.trainerId, trainerId))
    .orderBy(desc(trainerMemberNotesTable.createdAt))
    .limit(limit);
}

/**
 * All pinned notes for the trainer's members — used by the dashboard's
 * "things to remember" widget. The service joins this with member info so
 * the UI shows "⚠️ Ahmed: knee injury" without an extra round-trip.
 */
export async function listPinnedByTrainer(trainerId: string): Promise<TrainerNoteRow[]> {
  return db
    .select()
    .from(trainerMemberNotesTable)
    .where(
      and(
        eq(trainerMemberNotesTable.trainerId, trainerId),
        eq(trainerMemberNotesTable.pinned, true),
      ),
    )
    .orderBy(desc(trainerMemberNotesTable.createdAt));
}
