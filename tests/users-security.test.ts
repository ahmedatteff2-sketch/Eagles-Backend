/**
 * Security regression tests for `/api/users` and `/api/trainers`.
 *
 * Covers:
 *  - H-1: neither `passwordHash` nor `totpSecret` leak out of any
 *    `/api/users` response (list, single, create, update).
 *  - L-2: `/api/trainers` does not expose phone numbers.
 *
 * The TOTP-leak audit finding (SECURITY_AUDIT.md H-1) showed that the
 * existing handlers stripped `passwordHash` inline but left `totpSecret`
 * in the response. The new `toSafeUser()` helper in routes/users.ts is
 * the single point that strips both — these tests fail loudly if anyone
 * re-introduces inline `{ passwordHash: _, ...safe }` destructuring or
 * adds a new sensitive column without updating the helper.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import { usersTable } from "../src/db/schema/index.js";
import { eq } from "drizzle-orm";
import { ensureMigrated, resetAuthTables } from "./helpers/db.js";
import { createTestUser } from "./helpers/factories.js";

async function loginAs(phone: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ phone, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

beforeAll(async () => {
  await ensureMigrated();
});

beforeEach(async () => {
  await resetAuthTables();
});

describe("GET /api/users (admin/trainer list)", () => {
  it("strips passwordHash and totpSecret from every row", async () => {
    const admin = await createTestUser({ role: "admin" });
    // Seed a member with an enabled 2FA secret so a regression that
    // leaks the column shows up immediately.
    const member = await createTestUser({ role: "member" });
    await db
      .update(usersTable)
      .set({ totpSecret: "JBSWY3DPEHPK3PXP", totpEnabled: true })
      .where(eq(usersTable.id, member.id));

    const adminToken = await loginAs(admin.phone, admin.password);
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const row of res.body.data) {
      expect(row).not.toHaveProperty("passwordHash");
      expect(row).not.toHaveProperty("totpSecret");
    }
  });
});

describe("GET /api/users/:userId", () => {
  it("strips passwordHash and totpSecret for admins viewing a member", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });
    await db
      .update(usersTable)
      .set({ totpSecret: "JBSWY3DPEHPK3PXP", totpEnabled: true })
      .where(eq(usersTable.id, member.id));

    const adminToken = await loginAs(admin.phone, admin.password);
    const res = await request(app)
      .get(`/api/users/${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(member.id);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("totpSecret");
    // The boolean flag is fine to expose — only the secret itself is sensitive.
    expect(res.body.totpEnabled).toBe(true);
  });

  it("strips totpSecret when a member views their own row", async () => {
    const member = await createTestUser({ role: "member" });
    await db
      .update(usersTable)
      .set({ totpSecret: "JBSWY3DPEHPK3PXP", totpEnabled: true })
      .where(eq(usersTable.id, member.id));

    const token = await loginAs(member.phone, member.password);
    const res = await request(app).get(`/api/users/${member.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("totpSecret");
  });
});

describe("POST /api/users (admin create)", () => {
  it("does not echo passwordHash or totpSecret in the response", async () => {
    const admin = await createTestUser({ role: "admin" });
    const adminToken = await loginAs(admin.phone, admin.password);

    const res = await request(app).post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({
      name: "New Member",
      phone: "01055551234",
      password: "freshpw123",
      role: "member",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "New Member", role: "member" });
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("totpSecret");
  });
});

describe("PUT /api/users/:userId (admin update)", () => {
  it("does not echo passwordHash or totpSecret on the updated row", async () => {
    const admin = await createTestUser({ role: "admin" });
    const member = await createTestUser({ role: "member" });
    await db
      .update(usersTable)
      .set({ totpSecret: "JBSWY3DPEHPK3PXP", totpEnabled: true })
      .where(eq(usersTable.id, member.id));

    const adminToken = await loginAs(admin.phone, admin.password);
    const res = await request(app)
      .put(`/api/users/${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Renamed Member" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Member");
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("totpSecret");
  });
});

describe("GET /api/trainers", () => {
  it("does not expose phone numbers (admin caller)", async () => {
    const admin = await createTestUser({ role: "admin" });
    await createTestUser({ role: "trainer", name: "Coach A", phone: "01000000001" });
    await createTestUser({ role: "trainer", name: "Coach B", phone: "01000000002" });

    const adminToken = await loginAs(admin.phone, admin.password);
    const res = await request(app).get("/api/trainers").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    for (const row of res.body) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("name");
      expect(row).not.toHaveProperty("phone");
      expect(row).not.toHaveProperty("passwordHash");
      expect(row).not.toHaveProperty("totpSecret");
    }
  });
});
