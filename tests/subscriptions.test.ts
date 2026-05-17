/**
 * Subscriptions smoke tests. Covers:
 *  - admin can create / list plans, members can list but not mutate
 *  - assigning a plan computes endDate from startDate + duration
 *  - freeze/unfreeze pauses & extends the timeline correctly
 *  - bulk-extend updates only the listed rows
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/db/index.js";
import { ensureMigrated, resetAuthTables } from "./helpers/db.js";
import { createTestUser } from "./helpers/factories.js";

async function loginAs(phone: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ phone, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function resetSubscriptionsTables(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE payments, member_subscriptions, subscriptions RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  await ensureMigrated();
});

beforeEach(async () => {
  await resetAuthTables();
  await resetSubscriptionsTables();
});

afterAll(async () => {
  // Pool closure handled in tests/setup.ts.
});

describe("Subscriptions plan CRUD", () => {
  it("admin can create a plan and member can list it", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });

    const adminToken = await loginAs(admin.phone, admin.password);
    const memberToken = await loginAs(member.phone, member.password);

    // Admin creates a plan.
    const create = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "1 Month", duration: 30, price: 500 });
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({ name: "1 Month", duration: 30 });

    // Member can list — but not mutate.
    const list = await request(app)
      .get("/api/subscriptions")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const denied = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Hacked plan", duration: 1, price: 0 });
    expect(denied.status).toBe(403);
  });

  it("rejects invalid plan input", async () => {
    const admin = await createTestUser({ role: "admin" });
    const adminToken = await loginAs(admin.phone, admin.password);

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "", duration: -5, price: -1 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/member-subscriptions", () => {
  it("computes endDate as startDate + plan.duration days", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });
    const adminToken = await loginAs(admin.phone, admin.password);

    const plan = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "30d", duration: 30, price: 500 });
    expect(plan.status).toBe(201);

    const assigned = await request(app)
      .post("/api/member-subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: member.id,
        subscriptionId: plan.body.id,
        startDate: "2026-01-01",
        paymentAmount: 500,
        paymentMethod: "cash",
      });

    expect(assigned.status).toBe(201);
    expect(assigned.body).toMatchObject({
      userId: member.id,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      status: "active",
    });
  });
});

describe("freeze / unfreeze", () => {
  it("freezing then unfreezing extends endDate by the elapsed days", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });
    const adminToken = await loginAs(admin.phone, admin.password);

    const plan = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "30d", duration: 30, price: 500 });

    const ms = await request(app)
      .post("/api/member-subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: member.id, subscriptionId: plan.body.id, startDate: "2026-01-01" });

    const freeze = await request(app)
      .patch(`/api/member-subscriptions/${ms.body.id}/freeze`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(freeze.status).toBe(200);
    expect(freeze.body.status).toBe("frozen");

    // Cannot freeze twice.
    const dup = await request(app)
      .patch(`/api/member-subscriptions/${ms.body.id}/freeze`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(dup.status).toBe(409);

    // Unfreeze: same-second freeze means elapsed is rounded up to 1 day.
    const unfreeze = await request(app)
      .patch(`/api/member-subscriptions/${ms.body.id}/unfreeze`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(unfreeze.status).toBe(200);
    expect(unfreeze.body.status).toBe("active");
    expect(unfreeze.body.addedDays).toBeGreaterThanOrEqual(1);
    expect(unfreeze.body.endDate).toBe("2026-02-01");
    expect(unfreeze.body.totalFrozenDays).toBeGreaterThanOrEqual(1);
  });
});

describe("bulk-extend", () => {
  it("extends only the supplied member-subscription IDs", async () => {
    const admin = await createTestUser({ role: "admin" });
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    const m3 = await createTestUser();
    const adminToken = await loginAs(admin.phone, admin.password);

    const plan = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "30d", duration: 30, price: 500 });

    const subs = [];
    for (const u of [m1, m2, m3]) {
      const r = await request(app)
        .post("/api/member-subscriptions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ userId: u.id, subscriptionId: plan.body.id, startDate: "2026-01-01" });
      subs.push(r.body);
    }

    const extend = await request(app)
      .post("/api/member-subscriptions/bulk-extend")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ids: [subs[0].id, subs[1].id], days: 14 });

    expect(extend.status).toBe(200);
    expect(extend.body).toMatchObject({ updatedCount: 2, days: 14 });

    // m1's current sub should have been extended.
    const m1Now = await request(app)
      .get(`/api/member-subscriptions/${m1.id}/current`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(m1Now.body.endDate).toBe("2026-02-14");

    // m3's wasn't in the list — should still be the original endDate.
    const m3Now = await request(app)
      .get(`/api/member-subscriptions/${m3.id}/current`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(m3Now.body.endDate).toBe("2026-01-31");
  });

  it("rejects empty or oversized ID lists", async () => {
    const admin = await createTestUser({ role: "admin" });
    const adminToken = await loginAs(admin.phone, admin.password);

    const empty = await request(app)
      .post("/api/member-subscriptions/bulk-extend")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ids: [], days: 7 });
    expect(empty.status).toBe(400);

    const huge = await request(app)
      .post("/api/member-subscriptions/bulk-extend")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ids: Array.from({ length: 501 }, (_, i) => i + 1), days: 7 });
    expect(huge.status).toBe(400);
  });
});
