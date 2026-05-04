import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } from "../lib/jwt.js";
import { authenticate } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  phone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

async function cleanExpiredTokens(userId: string) {
  await db
    .delete(refreshTokensTable)
    .where(and(eq(refreshTokensTable.userId, userId), lt(refreshTokensTable.expiresAt, new Date())));
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);

  if (!user) {
    await bcrypt.compare(password, "$2b$10$dummyhashtopreventtimingattacks.XXXXXXXXXX");
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
    token: refreshToken,
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
  try {
    const payload = verifyRefreshToken(refreshToken);
    const [stored] = await db
      .select()
      .from(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.token, refreshToken),
          eq(refreshTokensTable.revoked, false),
        ),
      )
      .limit(1);

    if (!stored || stored.expiresAt < new Date()) {
      await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.token, refreshToken));
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }

    await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.token, refreshToken));

    const newPayload = { userId: payload.userId, role: payload.role };
    const newAccess = signAccessToken(newPayload);
    const newRefresh = signRefreshToken(newPayload);
    await db.insert(refreshTokensTable).values({
      userId: payload.userId,
      token: newRefresh,
      expiresAt: getRefreshTokenExpiry(),
    });

    res.json({ accessToken: newAccess, refreshToken: newRefresh, user: null });
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid refresh token" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const body = refreshSchema.safeParse(req.body);
  if (body.success) {
    await db
      .update(refreshTokensTable)
      .set({ revoked: true })
      .where(eq(refreshTokensTable.token, body.data.refreshToken));
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

  await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.userId, req.user!.userId));

  res.json({ success: true, message: "تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً" });
});

const updatePhoneSchema = z.object({
  newPhone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1),
});

router.post("/auth/update-phone", authenticate, async (req, res) => {
  const body = updatePhoneSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
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
  await db.update(usersTable).set({ phone: body.data.newPhone }).where(eq(usersTable.id, req.user!.userId));
  res.json({ success: true, message: "تم تحديث رقم الهاتف بنجاح" });
});

export default router;
