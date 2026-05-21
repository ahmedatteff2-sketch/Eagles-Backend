/**
 * Security regression tests for `/api/payments`.
 *
 * Covers SECURITY_AUDIT.md H-2: a logged-in member used to be able to read
 * any other user's payment history by passing `?userId=<other_member_id>`
 * because the handler resolved `targetUserId` from the query without an
 * admin-or-self gate. These tests pin the fix.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { pool, db } from "../src/db/index.js";
import { paymentsTable } from "../src/db/schema/index.js";
import { ensureMigrated, resetAuthTables } from "./helpers/db.js";
import { createTestUser } from "./helpers/factories.js";

async function loginAs(phone: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ phone, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

async function resetPaymentsTable(): Promise<void> {
  await pool.query(`TRUNCATE TABLE payments, member_subscriptions, subscriptions RESTART IDENTITY CASCADE`);
}

beforeAll(async () => {
  await ensureMigrated();
});

beforeEach(async () => {
  await resetAuthTables();
  await resetPaymentsTable();
});

describe("GET /api/payments — IDOR protection", () => {
  it("forbids a member from reading another member's payments via ?userId=", async () => {
    const victim = await createTestUser({ role: "member" });
    const attacker = await createTestUser({ role: "member" });

    // Seed a payment on the victim so the test would obviously fail if the
    // handler returned the rows.
    await db.insert(paymentsTable).values({
      userId: victim.id,
      amount: "500.00",
      date: "2026-01-01",
      method: "cash",
    });

    const attackerToken = await loginAs(attacker.phone, attacker.password);
    const res = await request(app)
      .get(`/api/payments?userId=${victim.id}`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("lets a member read their own payments via explicit ?userId=", async () => {
    const member = await createTestUser({ role: "member" });
    await db.insert(paymentsTable).values({
      userId: member.id,
      amount: "200.00",
      date: "2026-02-01",
      method: "cash",
    });

    const token = await loginAs(member.phone, member.password);
    const res = await request(app)
      .get(`/api/payments?userId=${member.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ userId: member.id });
  });

  it("scopes a member to their own payments when no userId is provided", async () => {
    const victim = await createTestUser({ role: "member" });
    const attacker = await createTestUser({ role: "member" });
    await db.insert(paymentsTable).values({
      userId: victim.id,
      amount: "1000.00",
      date: "2026-03-01",
      method: "card",
    });

    const token = await loginAs(attacker.phone, attacker.password);
    const res = await request(app).get("/api/payments").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Attacker has zero payments of their own and must not see the victim's.
    expect(res.body.data).toHaveLength(0);
  });

  it("admins can still read any user's payments", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });
    await db.insert(paymentsTable).values({
      userId: member.id,
      amount: "750.00",
      date: "2026-04-01",
      method: "transfer",
    });

    const adminToken = await loginAs(admin.phone, admin.password);
    const res = await request(app)
      .get(`/api/payments?userId=${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ userId: member.id });
  });
});
