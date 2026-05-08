import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { authenticator } from "otplib";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  sign2FAPartialToken,
  verify2FAPartialToken,
} from "../lib/jwt.js";
import { authenticate, type Role } from "../middlewares/auth.js";
import { recordAuditEvent } from "../middlewares/audit.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";
import { z } from "zod";

const router = Router();

// httpOnly cookie carrying the refresh token. Scoped to /api/auth so the
// browser only sends it on auth endpoints (refresh / logout) — every other
// API call uses the Authorization: Bearer <accessToken> header. This keeps
// the refresh token out of JavaScript reach (XSS-resistant) and limits its
// blast radius on the network.
const REFRESH_COOKIE_NAME = "eg_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_TTL_DAYS = (() => {
  const raw = Number(process.env.JWT_REFRESH_TTL_DAYS);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 30;
})();

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // Production is always HTTPS (Render). Dev runs over http://localhost so
    // we can't require Secure or the browser drops the cookie silently.
    secure: process.env.NODE_ENV === "production",
    // Lax is the right default for first-party flows (frontend served by the
    // same backend, Capacitor WebView loading server.url). We deliberately
    // avoid SameSite=None — that would require Secure everywhere AND opens
    // CSRF surface for any cross-site POST that targets /api/auth.
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  // Cookie attributes (path / sameSite / secure) MUST match the ones used
  // when setting it — otherwise the browser keeps the original cookie.
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

function readRefreshTokenFromRequest(req: Request): string | null {
  // Cookies preferred (new clients); body kept as a fallback so legacy
  // localStorage-based clients keep working until their refresh token
  // rotates onto a cookie or expires.
  const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.length > 0) return fromCookie;
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === "string" && fromBody.length > 0) return fromBody;
  return null;
}

// Pre-computed bcrypt hash used to keep login timing constant when the phone
// does not exist. Generated once at startup with the same cost as production
// hashes (cost 12) so timing matches a real comparison.
const TIMING_DUMMY_HASH = bcrypt.hashSync("__timing_attack_dummy__", 12);

// Account-lockout policy. Both env-tunable; sane defaults for an Egyptian
// gym SMB are 10 attempts / 30 minutes (long enough to deter brute force,
// short enough that legitimate users can call the gym to wait it out).
const MAX_FAILED_ATTEMPTS = (() => {
  const raw = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS);
  return Number.isFinite(raw) && raw >= 3 ? Math.floor(raw) : 10;
})();
const LOCKOUT_MINUTES = (() => {
  const raw = Number(process.env.LOGIN_LOCKOUT_MINUTES);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 30;
})();

// otplib defaults are TOTP / SHA1 / 6 digits / 30s — matches Google
// Authenticator, Authy, 1Password, and every standard authenticator app.
authenticator.options = { window: 1 };

const loginSchema = z.object({
  phone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
  totpCode: z.string().regex(/^[0-9]{6}$/).optional(),
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

function normalizeRole(raw: string): Role {
  const r = raw.toLowerCase();
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  return "member";
}

/**
 * Pretty-printed device label, e.g. "Chrome on macOS". Best-effort UA parser
 * — we deliberately avoid pulling in a UA-parsing library since the label is
 * informational only.
 */
function deviceLabel(req: Request): string {
  const ua = (req.headers["user-agent"] ?? "").toString();
  const lower = ua.toLowerCase();
  let browser = "Unknown browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("chromium/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/")) browser = "Safari";
  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os x") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";
  return `${browser} on ${os}`;
}

async function issueTokenPair(userId: string, role: Role, req: Request) {
  const payload = { userId, role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await cleanExpiredTokens(userId);
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
    userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 500) || null,
    ip: req.ip ?? null,
    label: deviceLabel(req),
    lastUsedAt: new Date(),
  });
  return { accessToken, refreshToken };
}

async function registerFailedAttempt(userId: string): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const [u] = await db
    .select({ failed: usersTable.failedLoginAttempts })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const next = (u?.failed ?? 0) + 1;
  if (next >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    await db
      .update(usersTable)
      .set({ failedLoginAttempts: next, lockedUntil })
      .where(eq(usersTable.id, userId));
    return { locked: true, lockedUntil };
  }
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: next })
    .where(eq(usersTable.id, userId));
  return { locked: false, lockedUntil: null };
}

async function clearFailedAttempts(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, userId));
}

router.post("/auth/login", async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const { phone, password, totpCode } = body.data;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    res.status(400).json({ error: "Validation error", message: "رقم هاتف غير صالح" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone)).limit(1);

  if (!user) {
    // Constant-time: still hit bcrypt so the timing channel doesn't leak
    // whether the phone exists.
    await bcrypt.compare(password, TIMING_DUMMY_HASH);
    void recordAuditEvent(req, "auth.login.failed", {
      status: 401,
      payload: { phone: normalizedPhone, reason: "no_such_user" },
    });
    res.status(401).json({ error: "Unauthorized", message: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    return;
  }

  // Lockout check FIRST — don't reveal whether the password would have been
  // correct while the account is frozen.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    void recordAuditEvent(req, "auth.login.locked", {
      status: 423,
      payload: { reason: "account_locked", minutesRemaining: minutes },
      actorIdOverride: user.id,
    });
    res.status(423).json({
      error: "Locked",
      message: `الحساب مغلق مؤقتاً بسبب محاولات دخول فاشلة. حاول بعد ${minutes} دقيقة`,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const { locked, lockedUntil } = await registerFailedAttempt(user.id);
    void recordAuditEvent(req, locked ? "auth.login.locked_now" : "auth.login.failed", {
      status: locked ? 423 : 401,
      actorIdOverride: user.id,
      payload: { reason: "bad_password", lockedUntil: lockedUntil?.toISOString() ?? null },
    });
    if (locked) {
      res.status(423).json({
        error: "Locked",
        message: `تم إغلاق الحساب لمدة ${LOCKOUT_MINUTES} دقيقة بسبب محاولات دخول فاشلة متكررة`,
      });
      return;
    }
    res.status(401).json({ error: "Unauthorized", message: "رقم الهاتف أو كلمة المرور غير صحيحة" });
    return;
  }

  // Password OK. If 2FA is enabled, require a TOTP code before completing
  // the login. The frontend submits the code via /auth/2fa/verify with the
  // partial token returned here.
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      const partialToken = sign2FAPartialToken(user.id);
      res.status(200).json({ requires2FA: true, partialToken });
      return;
    }
    const ok = authenticator.check(totpCode, user.totpSecret);
    if (!ok) {
      const { locked, lockedUntil } = await registerFailedAttempt(user.id);
      void recordAuditEvent(req, locked ? "auth.2fa.locked_now" : "auth.2fa.failed", {
        status: locked ? 423 : 401,
        actorIdOverride: user.id,
        payload: { lockedUntil: lockedUntil?.toISOString() ?? null },
      });
      if (locked) {
        res.status(423).json({ error: "Locked", message: `تم إغلاق الحساب لمدة ${LOCKOUT_MINUTES} دقيقة` });
        return;
      }
      res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
      return;
    }
  }

  await clearFailedAttempts(user.id);

  const role = normalizeRole(user.role);
  const { accessToken, refreshToken } = await issueTokenPair(user.id, role, req);
  setRefreshCookie(res, refreshToken);

  void recordAuditEvent(req, "auth.login.success", {
    status: 200,
    actorIdOverride: user.id,
    payload: { role },
  });

  // refreshToken is also returned in the body for one release as a
  // backward-compat bridge: existing clients still read it from JSON.
  // Frontend should ignore it once it migrates to cookie-based refresh.
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, phone: user.phone, role },
  });
});

const verify2FASchema = z.object({
  partialToken: z.string().min(1).max(2000),
  totpCode: z.string().regex(/^[0-9]{6}$/),
});

router.post("/auth/2fa/verify", async (req, res) => {
  const body = verify2FASchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  let userId: string;
  try {
    ({ userId } = verify2FAPartialToken(body.data.partialToken));
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "انتهت جلسة التحقق. يرجى تسجيل الدخول مجدداً" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(401).json({ error: "Unauthorized", message: "انتهت جلسة التحقق" });
    return;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(423).json({ error: "Locked", message: "الحساب مغلق مؤقتاً" });
    return;
  }
  const ok = authenticator.check(body.data.totpCode, user.totpSecret);
  if (!ok) {
    const { locked } = await registerFailedAttempt(user.id);
    void recordAuditEvent(req, locked ? "auth.2fa.locked_now" : "auth.2fa.failed", {
      status: locked ? 423 : 401,
      actorIdOverride: user.id,
    });
    if (locked) {
      res.status(423).json({ error: "Locked", message: `تم إغلاق الحساب لمدة ${LOCKOUT_MINUTES} دقيقة` });
      return;
    }
    res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
    return;
  }
  await clearFailedAttempts(user.id);
  const role = normalizeRole(user.role);
  const { accessToken, refreshToken } = await issueTokenPair(user.id, role, req);
  setRefreshCookie(res, refreshToken);

  void recordAuditEvent(req, "auth.login.success_2fa", {
    status: 200,
    actorIdOverride: user.id,
    payload: { role },
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, phone: user.phone, role },
  });
});

router.post("/auth/refresh", async (req, res) => {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) {
    res.status(401).json({ error: "Unauthorized", message: "Refresh token required" });
    return;
  }
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    // Bad signature → also clear any stale cookie so the client doesn't keep
    // resending the same broken token on every page load.
    clearRefreshCookie(res);
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
      void recordAuditEvent(req, "auth.refresh.reuse_detected", {
        status: 401,
        actorIdOverride: payload.userId,
      });
      await revokeAllUserTokens(payload.userId);
      clearRefreshCookie(res);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }
    if (stored.revoked) {
      logger.warn({ userId: payload.userId }, "Refresh token reuse detected — revoking all tokens");
      void recordAuditEvent(req, "auth.refresh.reuse_detected", {
        status: 401,
        actorIdOverride: payload.userId,
      });
      await revokeAllUserTokens(payload.userId);
      clearRefreshCookie(res);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }
    if (stored.expiresAt < new Date()) {
      await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.tokenHash, tokenHash));
      clearRefreshCookie(res);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    }

    await db.update(refreshTokensTable).set({ revoked: true }).where(eq(refreshTokensTable.tokenHash, tokenHash));

    const { accessToken: newAccess, refreshToken: newRefresh } = await issueTokenPair(
      payload.userId,
      payload.role as Role,
      req,
    );
    setRefreshCookie(res, newRefresh);

    // refreshToken is included in the body so legacy clients (still reading
    // the JSON response) keep working during the cookie rollout. Cookie-only
    // clients can ignore it.
    res.json({ accessToken: newAccess, refreshToken: newRefresh, user: null });
  } catch (err) {
    logger.error({ err }, "Refresh token rotation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await db
      .update(refreshTokensTable)
      .set({ revoked: true })
      .where(eq(refreshTokensTable.tokenHash, tokenHash));
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", authenticate, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      totpEnabled: usersTable.totpEnabled,
    })
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

// ── 2FA setup / enable / disable ─────────────────────────────────────────────

const enable2FASchema = z.object({
  totpCode: z.string().regex(/^[0-9]{6}$/),
});
const disable2FASchema = z.object({
  password: z.string().min(1).max(128),
  totpCode: z.string().regex(/^[0-9]{6}$/),
});

/**
 * Step 1 of 2FA setup. Generates a fresh secret, persists it (still
 * `totpEnabled = false`), and returns the otpauth URL the client uses to
 * render a QR code. Calling this again before /enable rotates the secret —
 * which is important if the user discards a setup attempt.
 */
router.post("/auth/2fa/setup", authenticate, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      totpEnabled: usersTable.totpEnabled,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (user.totpEnabled) {
    res.status(409).json({ error: "Conflict", message: "التحقق بخطوتين مفعّل بالفعل" });
    return;
  }
  const secret = authenticator.generateSecret();
  await db.update(usersTable).set({ totpSecret: secret }).where(eq(usersTable.id, user.id));
  const issuer = "Eagle Gym";
  const accountName = user.phone || user.name;
  const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);
  res.json({ secret, otpauthUrl });
});

router.post("/auth/2fa/enable", authenticate, async (req, res) => {
  const body = enable2FASchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "رمز التحقق غير صالح" });
    return;
  }
  const [user] = await db
    .select({
      id: usersTable.id,
      totpSecret: usersTable.totpSecret,
      totpEnabled: usersTable.totpEnabled,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user || !user.totpSecret) {
    res.status(400).json({ error: "Bad request", message: "ابدأ الإعداد أولاً" });
    return;
  }
  if (user.totpEnabled) {
    res.status(409).json({ error: "Conflict", message: "التحقق بخطوتين مفعّل بالفعل" });
    return;
  }
  if (!authenticator.check(body.data.totpCode, user.totpSecret)) {
    res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
    return;
  }
  await db.update(usersTable).set({ totpEnabled: true }).where(eq(usersTable.id, user.id));
  void recordAuditEvent(req, "auth.2fa.enabled", { status: 200 });
  res.json({ success: true });
});

router.post("/auth/2fa/disable", authenticate, async (req, res) => {
  const body = disable2FASchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const passOk = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!passOk) {
    res.status(401).json({ error: "Unauthorized", message: "كلمة المرور غير صحيحة" });
    return;
  }
  if (!user.totpSecret || !authenticator.check(body.data.totpCode, user.totpSecret)) {
    res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
    return;
  }
  await db
    .update(usersTable)
    .set({ totpEnabled: false, totpSecret: null })
    .where(eq(usersTable.id, user.id));
  void recordAuditEvent(req, "auth.2fa.disabled", { status: 200 });
  res.json({ success: true });
});

export default router;
