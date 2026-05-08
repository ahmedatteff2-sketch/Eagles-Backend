import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from "../lib/jwt.js";
import { authenticate } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";
import { z } from "zod";

const router = Router();

// Pre-computed bcrypt hash used to keep login timing constant when the phone
// does not exist. Generated once at startup with the same cost as production
// hashes (cost 12) so timing matches a real comparison.
const TIMING_DUMMY_HASH = bcrypt.hashSync("__timing_attack_dummy__", 12);

const loginSchema = z.object({
  phone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(2000),
});

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function cleanExpiredTokens(userId: string) {
  await db
    .delete(refreshTokensTable)
    .where(and(eq(refreshTokensTable.userId, userId), lt(refreshTokensTable.expiresAt, new Date())));
}

async function revokeAllUserTokens(userId: string) {
  await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.userId, userId));
}

function normalizeRole(raw: string): "admin" | "member" {
  return raw.toLowerCase() === "admin" ? "admin" : "member";
}

router.post("/auth/login", async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const { phone, password } = body.data;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    res.status(400).json({ error: "Validation error", message: "رقم هاتف غير صالح" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone)).limit(1);

  if (!user) {
    await bcrypt.compare(password, TIMING_DUMMY_HASH);
    res.status(401).json({ error: "Unauthorized", message: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    return;
  }

  const role = normalizeRole(user.role);
  const payload = { userId: user.id, role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await cleanExpiredTokens(user.id);
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, phone: user.phone, role },
  });
});

router.post("/auth/refresh", async (req, res) => {
  const body = refreshSchema.safeParse(req.body);
  if (!body.success) {
    res.status(401).json({ error: "Unauthorized", message: "Refresh token required" });
    return;
  }
  const { refreshToken } = body.data;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid refresh token" });
    return;
  }
  try {
    const tokenHash = hashRefreshToken(refreshToken);
    const [stored] = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash))
      .limit(1);

    // Reuse-detection: a valid signature but missing or already-revoked row
    // means the token was already consumed once. Treat as compromise and
    // revoke every refresh token for this user.
    if (!stored) {
      logger.warn({ userId: payload.userId }, "Refresh token reuse detected (token not in DB)");
      await revokeAllUserTokens(payload.userId);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }
    if (stored.revoked) {
      logger.warn({ userId: payload.userId }, "Refresh token reuse detected — revoking all tokens");
      await revokeAllUserTokens(payload.userId);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }
    if (stored.expiresAt < new Date()) {
      await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.tokenHash, tokenHash));
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }

    await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.tokenHash, tokenHash));

    const newPayload = { userId: payload.userId, role: payload.role };
    const newAccess = signAccessToken(newPayload);
    const newRefresh = signRefreshToken(newPayload);
    await db.insert(refreshTokensTable).values({
      userId: payload.userId,
      tokenHash: hashRefreshToken(newRefresh),
      expiresAt: getRefreshTokenExpiry(),
    });

    res.json({ accessToken: newAccess, refreshToken: newRefresh, user: null });
  } catch (err) {
    logger.error({ err }, "Refresh token rotation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const body = refreshSchema.safeParse(req.body);
  if (body.success) {
    const tokenHash = hashRefreshToken(body.data.refreshToken);
    await db
      .update(refreshTokensTable)
      .set({ revoked: true })
      .where(eq(refreshTokensTable.tokenHash, tokenHash));
  }
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", authenticate, async (req, res) => {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...user, role: normalizeRole(user.role) });
});

router.post("/auth/change-password", authenticate, async (req, res) => {
  const body = changePasswordSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Bad request", message: "كلمة المرور الحالية غير صحيحة" });
    return;
  }
  const hashed = await bcrypt.hash(body.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash: hashed }).where(eq(usersTable.id, req.user!.userId));

  await revokeAllUserTokens(req.user!.userId);

  res.json({ success: true, message: "تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً" });
});

const updatePhoneSchema = z.object({
  newPhone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
});

router.post("/auth/update-phone", authenticate, async (req, res) => {
  const body = updatePhoneSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const normalizedNewPhone = normalizePhone(body.data.newPhone);
  if (!normalizedNewPhone) {
    res.status(400).json({ error: "Validation error", message: "رقم الهاتف غير صالح" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const valid = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Bad request", message: "كلمة المرور غير صحيحة" });
    return;
  }
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, normalizedNewPhone))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== req.user!.userId) {
    res.status(409).json({ error: "Conflict", message: "رقم الهاتف مستخدم بالفعل" });
    return;
  }
  await db.update(usersTable).set({ phone: normalizedNewPhone }).where(eq(usersTable.id, req.user!.userId));

  // Phone is a credential — invalidate every active session.
  await revokeAllUserTokens(req.user!.userId);

  res.json({ success: true, message: "تم تحديث رقم الهاتف بنجاح. يرجى تسجيل الدخول مجدداً" });
});

export default router;
