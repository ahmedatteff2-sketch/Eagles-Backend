/**
 * Trainer-dashboard service. Aggregates the data that powers the trainer's
 * own portal — separate from `users.ts` because:
 *
 *  - The HTTP shape is dashboard-oriented (joins, roll-ups, "today" filters)
 *    rather than CRUD.
 *  - Authorization is *always* "trainer can only see their own assigned
 *    members" with no admin override. This file is the one place that rule
 *    lives, so a future RBAC change touches one file instead of every route.
 *
 * Every function takes `trainerId` as the *first* argument so it's
 * impossible to accidentally call a helper without scoping to a trainer.
 */
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  bodyStatsTable,
  checkinsTable,
  exerciseLogsTable,
  exercisesTable,
  memberSubscriptionsTable,
  scheduleTable,
  sessionRatingsTable,
  subscriptionsTable,
  trainerMemberNotesTable,
  TRAINER_NOTE_CATEGORIES,
  type TrainerNoteCategory,
  usersTable,
} from "../db/schema/index.js";
import * as notesRepo from "../repositories/trainer-notes.repo.js";

// ── Authorization gate ──────────────────────────────────────────────────────

/**
 * Returns true iff `memberId` is a member assigned to `trainerId`. The
 * single source of truth for "can this trainer touch this member's data".
 *
 * NOT cached — the answer can flip mid-session (admin reassigns a member)
 * and the cost is one indexed query.
 */
export async function trainerOwnsMember(trainerId: string, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, memberId),
        eq(usersTable.role, "member"),
        eq(usersTable.assignedTrainerId, trainerId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// ── Dashboard summary ───────────────────────────────────────────────────────

export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  expiringSoon: number; // active subs ending in next 7 days
  checkinsToday: number;
  checkinsThisWeek: number;
  averageRating: number | null; // mean of session_ratings over last 30 days
  pinnedNotesCount: number;
}

const DAY_MS = 86_400_000;

/**
 * One DB roundtrip per metric; we deliberately avoid materializing all
 * `userIds` in JS first because the WHERE-on-trainer index is just as fast
 * as a fan-out. Postgres optimizer collapses the IN-subqueries cleanly.
 */
export async function getDashboardSummary(trainerId: string): Promise<DashboardSummary> {
  const today = new Date().toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * DAY_MS).toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const monthAgo = new Date(Date.now() - 30 * DAY_MS);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Subquery: every member id assigned to this trainer.
  const trainersMembers = db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "member"),
        eq(usersTable.assignedTrainerId, trainerId),
      ),
    );

  const [[{ totalMembers }], [activeRow], [expiringRow], [todayRow], [weekRow], [ratingRow], [pinnedRow]] =
    await Promise.all([
      db
        .select({ totalMembers: count() })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.role, "member"),
            eq(usersTable.assignedTrainerId, trainerId),
          ),
        ),

      db
        .select({ activeMembers: count() })
        .from(memberSubscriptionsTable)
        .where(
          and(
            eq(memberSubscriptionsTable.status, "active"),
            sql`${memberSubscriptionsTable.endDate} >= ${today}`,
            inArray(memberSubscriptionsTable.userId, trainersMembers),
          ),
        ),

      db
        .select({ expiringSoon: count() })
        .from(memberSubscriptionsTable)
        .where(
          and(
            eq(memberSubscriptionsTable.status, "active"),
            sql`${memberSubscriptionsTable.endDate} >= ${today}`,
            sql`${memberSubscriptionsTable.endDate} <= ${weekAhead}`,
            inArray(memberSubscriptionsTable.userId, trainersMembers),
          ),
        ),

      db
        .select({ checkinsToday: count() })
        .from(checkinsTable)
        .where(
          and(
            gte(checkinsTable.timestamp, todayStart),
            inArray(checkinsTable.userId, trainersMembers),
          ),
        ),

      db
        .select({ checkinsThisWeek: count() })
        .from(checkinsTable)
        .where(
          and(
            gte(checkinsTable.timestamp, weekAgo),
            inArray(checkinsTable.userId, trainersMembers),
          ),
        ),

      // Mean rating: drizzle has no `avg()` helper that infers the right type
      // out of the box, so we use sql<number> to coerce.
      db
        .select({
          averageRating: sql<number | null>`AVG(${sessionRatingsTable.rating})::float`,
        })
        .from(sessionRatingsTable)
        .where(
          and(
            sql`${sessionRatingsTable.createdAt} >= ${monthAgo}`,
            inArray(sessionRatingsTable.userId, trainersMembers),
          ),
        ),

      db
        .select({ pinnedNotesCount: count() })
        .from(trainerMemberNotesTable)
        .where(
          and(
            eq(trainerMemberNotesTable.trainerId, trainerId),
            eq(trainerMemberNotesTable.pinned, true),
          ),
        ),
    ]);

  return {
    totalMembers: Number(totalMembers ?? 0),
    activeMembers: Number(activeRow?.activeMembers ?? 0),
    expiringSoon: Number(expiringRow?.expiringSoon ?? 0),
    checkinsToday: Number(todayRow?.checkinsToday ?? 0),
    checkinsThisWeek: Number(weekRow?.checkinsThisWeek ?? 0),
    averageRating:
      ratingRow?.averageRating == null ? null : Number(Number(ratingRow.averageRating).toFixed(2)),
    pinnedNotesCount: Number(pinnedRow?.pinnedNotesCount ?? 0),
  };
}

// ── Members list ────────────────────────────────────────────────────────────

export interface TrainerMemberRow {
  id: string;
  name: string;
  phone: string;
  membershipNumber: string | null;
  category: string;
  currentSubscription: {
    id: number;
    startDate: string;
    endDate: string;
    status: "active" | "expired" | "frozen";
    plan: string;
  } | null;
  lastCheckinAt: string | null;
}

export async function listMembers(trainerId: string): Promise<TrainerMemberRow[]> {
  const members = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      membershipNumber: usersTable.membershipNumber,
      category: usersTable.category,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "member"),
        eq(usersTable.assignedTrainerId, trainerId),
      ),
    )
    .orderBy(desc(usersTable.createdAt));

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.id);

  // Two side-queries that we then stitch into the member list. Both use
  // distinct-on-style queries via aggregation so we get the latest row per
  // member in a single statement.
  const [subs, lastCheckins] = await Promise.all([
    db
      .select({
        id: memberSubscriptionsTable.id,
        userId: memberSubscriptionsTable.userId,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        planName: subscriptionsTable.name,
        createdAt: memberSubscriptionsTable.createdAt,
      })
      .from(memberSubscriptionsTable)
      .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(inArray(memberSubscriptionsTable.userId, memberIds))
      .orderBy(desc(memberSubscriptionsTable.createdAt)),

    db
      .select({
        userId: checkinsTable.userId,
        ts: sql<Date>`MAX(${checkinsTable.timestamp})`.as("ts"),
      })
      .from(checkinsTable)
      .where(inArray(checkinsTable.userId, memberIds))
      .groupBy(checkinsTable.userId),
  ]);

  // First-seen-wins on the subs scan (ordered by createdAt desc) → "current".
  const subByMember = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (!subByMember.has(s.userId)) subByMember.set(s.userId, s);
  }
  const checkinByMember = new Map(lastCheckins.map((r) => [r.userId, r.ts]));

  return members.map((m) => {
    const s = subByMember.get(m.id);
    const ts = checkinByMember.get(m.id);
    return {
      ...m,
      currentSubscription: s
        ? {
            id: s.id,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status,
            plan: s.planName,
          }
        : null,
      lastCheckinAt: ts ? new Date(ts).toISOString() : null,
    };
  });
}

// ── Member profile ──────────────────────────────────────────────────────────

export interface MemberProfilePayload {
  member: {
    id: string;
    name: string;
    phone: string;
    membershipNumber: string | null;
    category: string;
    createdAt: Date;
  };
  currentSubscription: TrainerMemberRow["currentSubscription"];
  recentCheckins: Array<{ id: string; timestamp: Date; method: string }>;
  recentExerciseLogs: Array<{
    id: number;
    date: string;
    exerciseId: number;
    exerciseName: string;
    setNumber: number;
    reps: number;
    weight: string;
  }>;
  latestBodyStats: {
    date: string;
    weight: string | null;
    bodyFat: string | null;
  } | null;
  notes: Array<{
    id: number;
    note: string;
    category: string;
    pinned: boolean;
    trainerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export async function getMemberProfile(
  trainerId: string,
  memberId: string,
): Promise<MemberProfilePayload | null> {
  if (!(await trainerOwnsMember(trainerId, memberId))) return null;

  const [member] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      membershipNumber: usersTable.membershipNumber,
      category: usersTable.category,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, memberId))
    .limit(1);

  if (!member) return null;

  const [currentSub, checkins, logs, [body], notes] = await Promise.all([
    db
      .select({
        id: memberSubscriptionsTable.id,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        planName: subscriptionsTable.name,
      })
      .from(memberSubscriptionsTable)
      .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(eq(memberSubscriptionsTable.userId, memberId))
      .orderBy(desc(memberSubscriptionsTable.createdAt))
      .limit(1),

    db
      .select({
        id: checkinsTable.id,
        timestamp: checkinsTable.timestamp,
        method: checkinsTable.method,
      })
      .from(checkinsTable)
      .where(eq(checkinsTable.userId, memberId))
      .orderBy(desc(checkinsTable.timestamp))
      .limit(20),

    db
      .select({
        id: exerciseLogsTable.id,
        date: exerciseLogsTable.date,
        exerciseId: exerciseLogsTable.exerciseId,
        exerciseName: exercisesTable.name,
        setNumber: exerciseLogsTable.setNumber,
        reps: exerciseLogsTable.reps,
        weight: exerciseLogsTable.weight,
      })
      .from(exerciseLogsTable)
      .innerJoin(exercisesTable, eq(exerciseLogsTable.exerciseId, exercisesTable.id))
      .where(eq(exerciseLogsTable.userId, memberId))
      .orderBy(desc(exerciseLogsTable.date), desc(exerciseLogsTable.id))
      .limit(50),

    db
      .select({
        date: bodyStatsTable.date,
        weight: bodyStatsTable.weight,
        bodyFat: bodyStatsTable.bodyFat,
      })
      .from(bodyStatsTable)
      .where(eq(bodyStatsTable.userId, memberId))
      .orderBy(desc(bodyStatsTable.date))
      .limit(1),

    notesRepo.listByMember(memberId),
  ]);

  return {
    member,
    currentSubscription: currentSub[0]
      ? {
          id: currentSub[0].id,
          startDate: currentSub[0].startDate,
          endDate: currentSub[0].endDate,
          status: currentSub[0].status,
          plan: currentSub[0].planName,
        }
      : null,
    recentCheckins: checkins,
    recentExerciseLogs: logs,
    latestBodyStats: body
      ? { date: body.date, weight: body.weight, bodyFat: body.bodyFat }
      : null,
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      category: n.category,
      pinned: n.pinned,
      trainerId: n.trainerId,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
  };
}

// ── Schedule ────────────────────────────────────────────────────────────────

/**
 * Sessions on the gym calendar where `trainer_name` matches the trainer's
 * name. Imperfect (the schedule table stores the trainer as free text), but
 * good enough until we model trainer-FK on schedule rows.
 */
export async function getMySchedule(trainerId: string): Promise<
  Array<{
    id: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    className: string;
    capacity: number | null;
    location: string | null;
  }>
> {
  const [me] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, trainerId))
    .limit(1);
  if (!me) return [];

  return db
    .select({
      id: scheduleTable.id,
      dayOfWeek: scheduleTable.dayOfWeek,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      className: scheduleTable.className,
      capacity: scheduleTable.capacity,
      location: scheduleTable.location,
    })
    .from(scheduleTable)
    .where(eq(scheduleTable.trainerName, me.name))
    .orderBy(scheduleTable.dayOfWeek, scheduleTable.startTime);
}

// ── Performance ─────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  retentionRate: number | null; // active / (active + expired), 0..1
  averageRating: number | null;
  ratingCount: number;
  checkinsLast30d: number;
  checkinsLast7d: number;
  topMembers: Array<{
    id: string;
    name: string;
    checkinsLast30d: number;
  }>;
}

export async function getPerformance(trainerId: string): Promise<PerformanceMetrics> {
  const monthAgo = new Date(Date.now() - 30 * DAY_MS);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const today = new Date().toISOString().split("T")[0];

  const trainersMembers = db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "member"),
        eq(usersTable.assignedTrainerId, trainerId),
      ),
    );

  const [[totalRow], allSubs, [ratingAgg], [c30], [c7], top30] = await Promise.all([
    db
      .select({ total: count() })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.role, "member"),
          eq(usersTable.assignedTrainerId, trainerId),
        ),
      ),

    db
      .select({
        userId: memberSubscriptionsTable.userId,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        createdAt: memberSubscriptionsTable.createdAt,
      })
      .from(memberSubscriptionsTable)
      .where(inArray(memberSubscriptionsTable.userId, trainersMembers))
      .orderBy(desc(memberSubscriptionsTable.createdAt)),

    db
      .select({
        avg: sql<number | null>`AVG(${sessionRatingsTable.rating})::float`,
        cnt: count(),
      })
      .from(sessionRatingsTable)
      .where(
        and(
          sql`${sessionRatingsTable.createdAt} >= ${monthAgo}`,
          inArray(sessionRatingsTable.userId, trainersMembers),
        ),
      ),

    db
      .select({ c: count() })
      .from(checkinsTable)
      .where(
        and(
          gte(checkinsTable.timestamp, monthAgo),
          inArray(checkinsTable.userId, trainersMembers),
        ),
      ),

    db
      .select({ c: count() })
      .from(checkinsTable)
      .where(
        and(
          gte(checkinsTable.timestamp, weekAgo),
          inArray(checkinsTable.userId, trainersMembers),
        ),
      ),

    db
      .select({
        userId: checkinsTable.userId,
        name: usersTable.name,
        c: count().as("c"),
      })
      .from(checkinsTable)
      .innerJoin(usersTable, eq(usersTable.id, checkinsTable.userId))
      .where(
        and(
          gte(checkinsTable.timestamp, monthAgo),
          inArray(checkinsTable.userId, trainersMembers),
        ),
      )
      .groupBy(checkinsTable.userId, usersTable.name)
      .orderBy(sql`c DESC`)
      .limit(5),
  ]);

  // Roll the subs list into per-member status: a member is "active" if they
  // have any active sub whose endDate >= today; otherwise "expired" if they
  // ever had a sub. Members with no sub at all aren't counted in retention.
  const status = new Map<string, "active" | "expired">();
  for (const s of allSubs) {
    if (status.has(s.userId)) continue;
    if (s.status === "active" && s.endDate >= today) status.set(s.userId, "active");
    else status.set(s.userId, "expired");
  }
  let active = 0;
  let expired = 0;
  for (const v of status.values()) {
    if (v === "active") active++;
    else expired++;
  }
  const retentionDenom = active + expired;
  const retentionRate = retentionDenom === 0 ? null : Number((active / retentionDenom).toFixed(3));

  return {
    totalMembers: Number(totalRow?.total ?? 0),
    activeMembers: active,
    expiredMembers: expired,
    retentionRate,
    averageRating:
      ratingAgg?.avg == null ? null : Number(Number(ratingAgg.avg).toFixed(2)),
    ratingCount: Number(ratingAgg?.cnt ?? 0),
    checkinsLast30d: Number(c30?.c ?? 0),
    checkinsLast7d: Number(c7?.c ?? 0),
    topMembers: top30.map((t) => ({
      id: t.userId,
      name: t.name,
      checkinsLast30d: Number(t.c),
    })),
  };
}

// ── Notes ───────────────────────────────────────────────────────────────────

export type CreateNoteOutcome =
  | { type: "ok"; note: notesRepo.TrainerNoteRow }
  | { type: "not_assigned" }
  | { type: "invalid_category" };

export async function createNoteForMember(
  trainerId: string,
  memberId: string,
  body: { note: string; category: string; pinned?: boolean },
): Promise<CreateNoteOutcome> {
  if (!(TRAINER_NOTE_CATEGORIES as readonly string[]).includes(body.category)) {
    return { type: "invalid_category" };
  }
  if (!(await trainerOwnsMember(trainerId, memberId))) {
    return { type: "not_assigned" };
  }
  const note = await notesRepo.createNote({
    trainerId,
    memberId,
    note: body.note,
    category: body.category as TrainerNoteCategory,
    pinned: body.pinned ?? false,
  });
  return { type: "ok", note };
}

export type UpdateNoteOutcome =
  | { type: "ok"; note: notesRepo.TrainerNoteRow }
  | { type: "not_found" }
  | { type: "forbidden" }
  | { type: "invalid_category" };

export async function updateNote(
  trainerId: string,
  noteId: number,
  patch: { note?: string; category?: string; pinned?: boolean },
): Promise<UpdateNoteOutcome> {
  const existing = await notesRepo.findNoteById(noteId);
  if (!existing) return { type: "not_found" };
  if (existing.trainerId !== trainerId) return { type: "forbidden" };
  if (
    patch.category !== undefined &&
    !(TRAINER_NOTE_CATEGORIES as readonly string[]).includes(patch.category)
  ) {
    return { type: "invalid_category" };
  }
  const updated = await notesRepo.updateNote(noteId, patch);
  if (!updated) return { type: "not_found" };
  return { type: "ok", note: updated };
}

export type DeleteNoteOutcome = { type: "ok" } | { type: "not_found" } | { type: "forbidden" };

export async function deleteNote(trainerId: string, noteId: number): Promise<DeleteNoteOutcome> {
  const existing = await notesRepo.findNoteById(noteId);
  if (!existing) return { type: "not_found" };
  if (existing.trainerId !== trainerId) return { type: "forbidden" };
  await notesRepo.deleteNote(noteId);
  return { type: "ok" };
}

export async function listRecentNotes(trainerId: string, limit?: number): Promise<notesRepo.TrainerNoteRow[]> {
  return notesRepo.listRecentByTrainer(trainerId, limit);
}

export async function listPinnedNotesWithMember(trainerId: string): Promise<
  Array<{
    id: number;
    note: string;
    category: string;
    createdAt: Date;
    member: { id: string; name: string; phone: string };
  }>
> {
  // One join — pinned notes are bounded (rare) so we don't bother with a
  // two-step fetch.
  const rows = await db
    .select({
      id: trainerMemberNotesTable.id,
      note: trainerMemberNotesTable.note,
      category: trainerMemberNotesTable.category,
      createdAt: trainerMemberNotesTable.createdAt,
      memberId: usersTable.id,
      memberName: usersTable.name,
      memberPhone: usersTable.phone,
    })
    .from(trainerMemberNotesTable)
    .innerJoin(usersTable, eq(usersTable.id, trainerMemberNotesTable.memberId))
    .where(
      and(
        eq(trainerMemberNotesTable.trainerId, trainerId),
        eq(trainerMemberNotesTable.pinned, true),
      ),
    )
    .orderBy(desc(trainerMemberNotesTable.createdAt));

  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    category: r.category,
    createdAt: r.createdAt,
    member: { id: r.memberId, name: r.memberName, phone: r.memberPhone },
  }));
}
