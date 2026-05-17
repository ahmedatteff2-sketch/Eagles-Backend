/**
 * Auth smoke tests. Exercises the critical paths through /api/auth so any
 * regression in login / refresh / lockout / 2FA shows up in CI before it
 * ships. We deliberately use Supertest against the real `app` (no mocks)
 * with a real Postgres so the schema-vs-code wiring is also validated.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import { usersTable, refreshTokensTable } from "../src/db/schema/index.js";
import { eq } from "drizzle-orm";
import { ensureMigrated, resetAuthTables } from "./helpers/db.js";
import { createTestUser } from "./helpers/factories.js";

beforeAll(async () => {
  await ensureMigrated();
});

beforeEach(async () => {
  await resetAuthTables();
});

describe("POST /api/auth/login", () => {
  it("returns 401 for an unknown phone (and is constant-time-ish)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "01099999999", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 400 for malformed input", async () => {
    const res = await request(app).post("/api/auth/login").send({ phone: "", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("issues access + refresh tokens for valid credentials", async () => {
    const user = await createTestUser({ role: "admin" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: user.id, phone: user.phone, role: "admin" },
    });

    // Refresh token row was written.
    const stored = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.userId, user.id));
    expect(stored).toHaveLength(1);
    expect(stored[0].revoked).toBe(false);
  });

  it("rejects a wrong password and increments failedLoginAttempts", async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: "wrong_password" });

    expect(res.status).toBe(401);

    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    expect(row.failedLoginAttempts).toBe(1);
    expect(row.lockedUntil).toBeNull();
  });

  it("locks the account after MAX_FAILED_ATTEMPTS wrong passwords", async () => {
    const user = await createTestUser();
    // Default policy: 10 attempts. Hammer it.
    let lastStatus = 0;
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post("/api/auth/login")
        .send({ phone: user.phone, password: "nope" });
      lastStatus = r.status;
    }
    // The 10th attempt should hit the lockout branch (423 Locked).
    expect(lastStatus).toBe(423);

    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    expect(row.failedLoginAttempts).toBeGreaterThanOrEqual(10);
    expect(row.lockedUntil).not.toBeNull();
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects login while the account is locked even with the correct password", async () => {
    const user = await createTestUser();
    // Manually lock by writing the future timestamp.
    const future = new Date(Date.now() + 60_000);
    await db.update(usersTable).set({ lockedUntil: future }).where(eq(usersTable.id, user.id));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    expect(res.status).toBe(423);
    expect(res.body.error).toBe("Locked");
  });

  it("clears failed attempts and lockedUntil on a successful login", async () => {
    const user = await createTestUser();
    // Pretend there were a couple of failed attempts but no lockout yet.
    await db
      .update(usersTable)
      .set({ failedLoginAttempts: 5 })
      .where(eq(usersTable.id, user.id));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    expect(row.failedLoginAttempts).toBe(0);
    expect(row.lockedUntil).toBeNull();
  });
});

describe("POST /api/auth/refresh", () => {
  async function loginAndGetTokens(): Promise<{ access: string; refresh: string; userId: string }> {
    const user = await createTestUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });
    return { access: res.body.accessToken, refresh: res.body.refreshToken, userId: user.id };
  }

  it("rotates tokens on a valid refresh", async () => {
    const { refresh } = await loginAndGetTokens();

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(refresh);
  });

  it("revokes ALL of the user's tokens when a revoked one is reused", async () => {
    const { refresh, userId } = await loginAndGetTokens();

    // First refresh: succeeds, revokes the old token, issues a new one.
    const ok = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(ok.status).toBe(200);

    // Second refresh with the same (now-revoked) token: must trigger reuse
    // detection and revoke every token for the user.
    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(reuse.status).toBe(401);

    const tokens = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.userId, userId));
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.revoked === true)).toBe(true);
  });

  it("rejects a malformed refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not.a.real.jwt" });
    expect(res.status).toBe(401);
  });

  it("rejects a missing refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the supplied refresh token", async () => {
    const user = await createTestUser();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });
    const refresh = login.body.refreshToken as string;

    const res = await request(app).post("/api/auth/logout").send({ refreshToken: refresh });
    expect(res.status).toBe(200);

    // The next refresh attempt with that token should now fail (it's revoked,
    // which the route treats as reuse and returns 401).
    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken: refresh });
    expect(reuse.status).toBe(401);
  });

  it("returns 200 even when no token is supplied (logout is best-effort)", async () => {
    const res = await request(app).post("/api/auth/logout").send({});
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user with a valid access token", async () => {
    const user = await createTestUser({ role: "admin", name: "Admin Person" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      name: "Admin Person",
      phone: user.phone,
      role: "admin",
    });
  });
});

describe("2FA login flow", () => {
  it("requires a TOTP code when 2FA is enabled, then issues tokens on the verify step", async () => {
    const user = await createTestUser();
    const secret = authenticator.generateSecret();
    await db
      .update(usersTable)
      .set({ totpEnabled: true, totpSecret: secret })
      .where(eq(usersTable.id, user.id));

    // Step 1: password-only — server should respond with `requires2FA: true`.
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });
    expect(step1.status).toBe(200);
    expect(step1.body.requires2FA).toBe(true);
    expect(step1.body.partialToken).toEqual(expect.any(String));

    // Step 2: submit the right TOTP code to /auth/2fa/verify.
    const code = authenticator.generate(secret);
    const step2 = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ partialToken: step1.body.partialToken, totpCode: code });

    expect(step2.status).toBe(200);
    expect(step2.body.accessToken).toEqual(expect.any(String));
    expect(step2.body.refreshToken).toEqual(expect.any(String));
    expect(step2.body.user.id).toBe(user.id);
  });

  it("rejects an invalid TOTP code at /auth/2fa/verify", async () => {
    const user = await createTestUser();
    const secret = authenticator.generateSecret();
    await db
      .update(usersTable)
      .set({ totpEnabled: true, totpSecret: secret })
      .where(eq(usersTable.id, user.id));

    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    const step2 = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ partialToken: step1.body.partialToken, totpCode: "000000" });

    expect(step2.status).toBe(401);
  });

  it("rejects an expired or tampered partial token", async () => {
    const res = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ partialToken: "garbage.token.here", totpCode: "123456" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password and revokes existing sessions", async () => {
    const user = await createTestUser();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });
    const access = login.body.accessToken as string;
    const refresh = login.body.refreshToken as string;

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${access}`)
      .send({ currentPassword: user.password, newPassword: "new_password_456" });

    expect(res.status).toBe(200);

    // Old refresh token must be revoked.
    const tokens = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.userId, user.id));
    expect(tokens.every((t) => t.revoked === true)).toBe(true);

    // Old refresh shouldn't work anymore.
    const refreshAfter = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refresh });
    expect(refreshAfter.status).toBe(401);

    // New password works.
    const reLogin = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: "new_password_456" });
    expect(reLogin.status).toBe(200);
  });

  it("rejects a wrong currentPassword", async () => {
    const user = await createTestUser();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: "definitely_wrong", newPassword: "new_password_456" });

    expect(res.status).toBe(400);
  });

  it("validates newPassword is at least 8 characters", async () => {
    const user = await createTestUser();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ phone: user.phone, password: user.password });

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: user.password, newPassword: "short" });

    expect(res.status).toBe(400);
  });
});

describe("password hashing", () => {
  it("test factory stores a bcrypt hash, not plaintext", async () => {
    const user = await createTestUser();
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    expect(row.passwordHash).not.toBe(user.password);
    expect(await bcrypt.compare(user.password, row.passwordHash)).toBe(true);
  });
});
