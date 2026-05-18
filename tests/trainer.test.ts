/**
 * Trainer-dashboard API tests. The contract under test:
 *
 *  1. RBAC — only `role=trainer` can hit `/api/trainer/*`. Admins and
 *     members get 403 / 401.
 *  2. Scope — every endpoint that returns members or member-scoped data
 *     must NEVER leak data about a member who isn't assigned to the
 *     calling trainer. This is the single biggest failure mode for a
 *     "see only my members" feature.
 *  3. Notes CRUD — a trainer can create/edit/delete their own notes only;
 *     a different trainer's notes are off limits.
 *
 * We hit the real `app` with Supertest and a real Postgres so the SQL
 * (especially the IN-subquery scoping) is exercised end-to-end.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import {
  checkinsTable,
  memberSubscriptionsTable,
  scheduleTable,
  sessionRatingsTable,
  subscriptionsTable,
  trainerMemberNotesTable,
  usersTable,
} from "../src/db/schema/index.js";
import { eq } from "drizzle-orm";
import { ensureMigrated, pool } from "./helpers/db.js";
import { createTestUser } from "./helpers/factories.js";

async function loginAs(phone: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ phone, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function resetTrainerWorld(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE
       trainer_member_notes,
       session_ratings,
       payments,
       member_subscriptions,
       subscriptions,
       schedule,
       "CheckIn",
       refresh_tokens,
       audit_logs,
       "User"
     RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  await ensureMigrated();
});

beforeEach(async () => {
  await resetTrainerWorld();
});

describe("RBAC on /api/trainer/*", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/trainer/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns 403 for an admin (admins use admin endpoints)", async () => {
    const admin = await createTestUser({ role: "admin" });
    const token = await loginAs(admin.phone, admin.password);
    const res = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a member", async () => {
    const member = await createTestUser({ role: "member" });
    const token = await loginAs(member.phone, member.password);
    const res = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for a trainer", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/trainer/dashboard", () => {
  it("counts only members assigned to the calling trainer", async () => {
    const trainerA = await createTestUser({ role: "trainer", name: "Trainer A" });
    const trainerB = await createTestUser({ role: "trainer", name: "Trainer B" });
    // 3 assigned to A, 2 assigned to B, 1 unassigned. The orphan must NOT
    // count toward either trainer's totals.
    await createTestUser({ role: "member", assignedTrainerId: trainerA.id });
    await createTestUser({ role: "member", assignedTrainerId: trainerA.id });
    await createTestUser({ role: "member", assignedTrainerId: trainerA.id });
    await createTestUser({ role: "member", assignedTrainerId: trainerB.id });
    await createTestUser({ role: "member", assignedTrainerId: trainerB.id });
    await createTestUser({ role: "member" });

    const tokenA = await loginAs(trainerA.phone, trainerA.password);
    const tokenB = await loginAs(trainerB.phone, trainerB.password);

    const resA = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${tokenA}`);
    const resB = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(resA.body.summary.totalMembers).toBe(3);
    expect(resB.body.summary.totalMembers).toBe(2);
  });

  it("counts active members and expiring-soon correctly", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const m1 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });
    const m2 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });
    const m3 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });

    const [plan] = await db
      .insert(subscriptionsTable)
      .values({ name: "1m", duration: 30, price: "500" })
      .returning();

    const today = new Date().toISOString().split("T")[0];
    const in3days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
    const in60days = new Date(Date.now() + 60 * 86_400_000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    // Active + expiring soon (in 3 days)
    await db
      .insert(memberSubscriptionsTable)
      .values({
        userId: m1.id,
        subscriptionId: plan.id,
        startDate: today,
        endDate: in3days,
        status: "active",
      });
    // Active, far from expiry
    await db
      .insert(memberSubscriptionsTable)
      .values({
        userId: m2.id,
        subscriptionId: plan.id,
        startDate: today,
        endDate: in60days,
        status: "active",
      });
    // Expired (endDate in past)
    await db
      .insert(memberSubscriptionsTable)
      .values({
        userId: m3.id,
        subscriptionId: plan.id,
        startDate: yesterday,
        endDate: yesterday,
        status: "active",
      });

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.activeMembers).toBe(2);
    expect(res.body.summary.expiringSoon).toBe(1);
  });
});

describe("GET /api/trainer/members", () => {
  it("lists only my members, with their current subscription joined", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const otherTrainer = await createTestUser({ role: "trainer" });
    const mine1 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Mine One",
    });
    const mine2 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Mine Two",
    });
    await createTestUser({
      role: "member",
      assignedTrainerId: otherTrainer.id,
      name: "Other Trainer's Member",
    });

    const [plan] = await db
      .insert(subscriptionsTable)
      .values({ name: "1m", duration: 30, price: "500" })
      .returning();
    await db.insert(memberSubscriptionsTable).values({
      userId: mine1.id,
      subscriptionId: plan.id,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/members")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ids = res.body.data.map((m: { id: string }) => m.id).sort();
    expect(ids).toEqual([mine1.id, mine2.id].sort());

    const withSub = res.body.data.find((m: { id: string }) => m.id === mine1.id);
    expect(withSub.currentSubscription).toMatchObject({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      plan: "1m",
    });
    const withoutSub = res.body.data.find((m: { id: string }) => m.id === mine2.id);
    expect(withoutSub.currentSubscription).toBeNull();
  });

  it("returns empty list when trainer has no assigned members", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/members")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /api/trainer/members/:memberId", () => {
  it("returns full profile for an assigned member", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const member = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Profile Subject",
    });
    const token = await loginAs(trainer.phone, trainer.password);

    const res = await request(app)
      .get(`/api/trainer/members/${member.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ id: member.id, name: "Profile Subject" });
    expect(res.body.recentCheckins).toEqual([]);
    expect(res.body.recentExerciseLogs).toEqual([]);
    expect(res.body.notes).toEqual([]);
  });

  it("returns 404 when the member belongs to another trainer", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const otherTrainer = await createTestUser({ role: "trainer" });
    const theirMember = await createTestUser({
      role: "member",
      assignedTrainerId: otherTrainer.id,
    });
    const token = await loginAs(trainer.phone, trainer.password);

    const res = await request(app)
      .get(`/api/trainer/members/${theirMember.id}`)
      .set("Authorization", `Bearer ${token}`);

    // We deliberately return 404 (not 403) so the trainer can't probe
    // whether a given userId is a member elsewhere in the system.
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent member id", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/members/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/trainer/schedule", () => {
  it("returns sessions where the schedule's trainer_name matches the trainer name", async () => {
    const trainer = await createTestUser({ role: "trainer", name: "Coach Sami" });
    const otherTrainer = await createTestUser({ role: "trainer", name: "Coach Other" });

    await db.insert(scheduleTable).values([
      {
        dayOfWeek: "saturday",
        startTime: "10:00",
        endTime: "11:00",
        className: "HIIT",
        trainerName: "Coach Sami",
      },
      {
        dayOfWeek: "monday",
        startTime: "18:00",
        endTime: "19:00",
        className: "Boxing",
        trainerName: "Coach Sami",
      },
      {
        dayOfWeek: "tuesday",
        startTime: "08:00",
        endTime: "09:00",
        className: "Yoga",
        trainerName: "Coach Other",
      },
    ]);

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/schedule")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((s: { className: string }) => s.className).sort()).toEqual(["Boxing", "HIIT"]);
  });
});

describe("GET /api/trainer/performance", () => {
  it("computes retention from active vs expired latest subs", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const m1 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });
    const m2 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });
    const m3 = await createTestUser({ role: "member", assignedTrainerId: trainer.id });

    const [plan] = await db
      .insert(subscriptionsTable)
      .values({ name: "1m", duration: 30, price: "500" })
      .returning();

    const today = new Date().toISOString().split("T")[0];
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    // m1: active. m2: active. m3: expired.
    await db.insert(memberSubscriptionsTable).values([
      { userId: m1.id, subscriptionId: plan.id, startDate: today, endDate: in30, status: "active" },
      { userId: m2.id, subscriptionId: plan.id, startDate: today, endDate: in30, status: "active" },
      { userId: m3.id, subscriptionId: plan.id, startDate: yesterday, endDate: yesterday, status: "expired" },
    ]);

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/performance")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMembers).toBe(3);
    expect(res.body.activeMembers).toBe(2);
    expect(res.body.expiredMembers).toBe(1);
    // 2/3 ≈ 0.667
    expect(res.body.retentionRate).toBeGreaterThan(0.66);
    expect(res.body.retentionRate).toBeLessThan(0.68);
  });

  it("computes averageRating only from this trainer's members", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const otherTrainer = await createTestUser({ role: "trainer" });
    const myMember = await createTestUser({ role: "member", assignedTrainerId: trainer.id });
    const theirMember = await createTestUser({
      role: "member",
      assignedTrainerId: otherTrainer.id,
    });

    const today = new Date().toISOString().split("T")[0];
    await db.insert(sessionRatingsTable).values([
      { userId: myMember.id, rating: 5, date: today },
      { userId: myMember.id, rating: 3, date: today },
      // Other trainer's rating must NOT pull our average up.
      { userId: theirMember.id, rating: 1, date: today },
    ]);

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/performance")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.ratingCount).toBe(2);
    expect(res.body.averageRating).toBe(4);
  });

  it("ranks topMembers by check-ins in last 30 days", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const m1 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Top Member",
    });
    const m2 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Mid Member",
    });

    // Use unique IDs (CheckIn.id is TEXT primary, no default)
    const baseTs = new Date();
    const rows: { id: string; userId: string; timestamp: Date; method: string }[] = [];
    for (let i = 0; i < 5; i++) {
      rows.push({
        id: `c-m1-${i}`,
        userId: m1.id,
        timestamp: new Date(baseTs.getTime() - i * 86_400_000),
        method: "MANUAL",
      });
    }
    for (let i = 0; i < 2; i++) {
      rows.push({
        id: `c-m2-${i}`,
        userId: m2.id,
        timestamp: new Date(baseTs.getTime() - i * 86_400_000),
        method: "MANUAL",
      });
    }
    await db.insert(checkinsTable).values(rows);

    const token = await loginAs(trainer.phone, trainer.password);
    const res = await request(app)
      .get("/api/trainer/performance")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.topMembers).toHaveLength(2);
    expect(res.body.topMembers[0]).toMatchObject({ id: m1.id, checkinsLast30d: 5 });
    expect(res.body.topMembers[1]).toMatchObject({ id: m2.id, checkinsLast30d: 2 });
  });
});

describe("Trainer notes CRUD", () => {
  it("trainer can create a note for an assigned member", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const member = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
    });
    const token = await loginAs(trainer.phone, trainer.password);

    const res = await request(app)
      .post(`/api/trainer/members/${member.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "knee injury — adjust squats", category: "injury", pinned: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      memberId: member.id,
      trainerId: trainer.id,
      category: "injury",
      pinned: true,
    });

    // Profile endpoint surfaces it.
    const profile = await request(app)
      .get(`/api/trainer/members/${member.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profile.body.notes).toHaveLength(1);
    expect(profile.body.notes[0].pinned).toBe(true);
  });

  it("rejects creating a note for a member assigned to another trainer", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const otherTrainer = await createTestUser({ role: "trainer" });
    const theirMember = await createTestUser({
      role: "member",
      assignedTrainerId: otherTrainer.id,
    });
    const token = await loginAs(trainer.phone, trainer.password);

    const res = await request(app)
      .post(`/api/trainer/members/${theirMember.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "hello", category: "general" });

    expect(res.status).toBe(403);
    // Make sure the row never got inserted.
    const all = await db.select().from(trainerMemberNotesTable);
    expect(all).toHaveLength(0);
  });

  it("rejects an unknown category at the API boundary", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const member = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
    });
    const token = await loginAs(trainer.phone, trainer.password);

    const res = await request(app)
      .post(`/api/trainer/members/${member.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "oops", category: "DROP TABLE" });

    expect(res.status).toBe(400);
  });

  it("trainer can edit their own note but not someone else's", async () => {
    const trainerA = await createTestUser({ role: "trainer" });
    const trainerB = await createTestUser({ role: "trainer" });
    const memberA = await createTestUser({
      role: "member",
      assignedTrainerId: trainerA.id,
    });
    const tokenA = await loginAs(trainerA.phone, trainerA.password);
    const tokenB = await loginAs(trainerB.phone, trainerB.password);

    const created = await request(app)
      .post(`/api/trainer/members/${memberA.id}/notes`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ note: "first", category: "general" });
    const noteId = created.body.id as number;

    // Owner can update.
    const ok = await request(app)
      .patch(`/api/trainer/notes/${noteId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ note: "edited", pinned: true });
    expect(ok.status).toBe(200);
    expect(ok.body.note).toBe("edited");
    expect(ok.body.pinned).toBe(true);

    // Different trainer can't.
    const denied = await request(app)
      .patch(`/api/trainer/notes/${noteId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ note: "hijacked" });
    expect(denied.status).toBe(403);

    // Original trainer's content is unchanged.
    const [row] = await db
      .select()
      .from(trainerMemberNotesTable)
      .where(eq(trainerMemberNotesTable.id, noteId));
    expect(row.note).toBe("edited");
  });

  it("trainer can delete their own note but not someone else's", async () => {
    const trainerA = await createTestUser({ role: "trainer" });
    const trainerB = await createTestUser({ role: "trainer" });
    const memberA = await createTestUser({
      role: "member",
      assignedTrainerId: trainerA.id,
    });
    const tokenA = await loginAs(trainerA.phone, trainerA.password);
    const tokenB = await loginAs(trainerB.phone, trainerB.password);

    const created = await request(app)
      .post(`/api/trainer/members/${memberA.id}/notes`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ note: "to be deleted", category: "general" });
    const noteId = created.body.id as number;

    const denied = await request(app)
      .delete(`/api/trainer/notes/${noteId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/trainer/notes/${noteId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(ok.status).toBe(204);

    const remaining = await db.select().from(trainerMemberNotesTable);
    expect(remaining).toHaveLength(0);
  });

  it("dashboard surfaces pinned notes with member info", async () => {
    const trainer = await createTestUser({ role: "trainer" });
    const m1 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Pinned Person",
    });
    const m2 = await createTestUser({
      role: "member",
      assignedTrainerId: trainer.id,
      name: "Unpinned Person",
    });
    const token = await loginAs(trainer.phone, trainer.password);

    await request(app)
      .post(`/api/trainer/members/${m1.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "remember this", category: "behavior", pinned: true });
    await request(app)
      .post(`/api/trainer/members/${m2.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "fyi", category: "general" });

    const res = await request(app)
      .get("/api/trainer/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.pinnedNotesCount).toBe(1);
    expect(res.body.pinnedNotes).toHaveLength(1);
    expect(res.body.pinnedNotes[0]).toMatchObject({
      note: "remember this",
      member: { id: m1.id, name: "Pinned Person" },
    });
    expect(res.body.recentNotes).toHaveLength(2);
  });
});
