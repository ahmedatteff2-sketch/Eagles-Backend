/**
 * Auth HTTP layer. This file is intentionally thin — it parses Zod schemas,
 * delegates to `services/auth.service.ts` for the business logic, and then
 * maps the tagged outcome back to a JSON response with a status code.
 *
 * If you find yourself adding `db.select(...)` here, that's a code-smell:
 * push it into the service or the repository instead.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.js";
import { recordAuditEvent } from "../middlewares/audit.js";
import { normalizePhone } from "../lib/phone.js";
import { sign2FAPartialToken, verify2FAPartialToken } from "../lib/jwt.js";
import * as authService from "../services/auth.service.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ── Refresh-token cookie ─────────────────────────────────────────────────────
//
// The refresh token is delivered as an httpOnly cookie scoped to /api/auth, so
// the browser only sends it on the refresh/logout endpoints — every other API
// call authenticates with the `Authorization: Bearer <accessToken>` header.
// httpOnly keeps it out of JavaScript's reach (XSS-resistant); the narrow path
// limits its blast radius on the wire.
const REFRESH_COOKIE_NAME = "eg_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_TTL_DAYS = (() => {
  const raw = Number(process.env.JWT_REFRESH_TTL_DAYS);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 30;
})();

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // Production is always HTTPS (Render); dev runs over http://localhost so we
    // can't require Secure there or the browser drops the cookie silently.
    secure: process.env.NODE_ENV === "production",
    // Lax suits first-party flows (frontend served by this backend, Capacitor
    // WebView loading the server URL). We avoid SameSite=None on purpose — it
    // would force Secure everywhere and widen the CSRF surface on /api/auth.
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  // Attributes (path / sameSite / secure) MUST match setRefreshCookie, or the
  // browser won't replace/remove the original cookie.
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

function readRefreshTokenFromRequest(req: Request): string | null {
  // Prefer the cookie (new clients); fall back to the request body so legacy
  // localStorage clients keep working until their token rotates or expires.
  const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.length > 0) return fromCookie;
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === "string" && fromBody.length > 0) return fromBody;
  return null;
}

const loginSchema = z.object({
  phone: z
    .string()
    .min(5)
    .max(20)
    .regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
  totpCode: z
    .string()
    .regex(/^[0-9]{6}$/)
    .optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

const updatePhoneSchema = z.object({
  newPhone: z
    .string()
    .min(5)
    .max(20)
    .regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح"),
  password: z.string().min(1).max(128),
});

const verify2FASchema = z.object({
  partialToken: z.string().min(1).max(2000),
  totpCode: z.string().regex(/^[0-9]{6}$/),
});

const enable2FASchema = z.object({
  totpCode: z.string().regex(/^[0-9]{6}$/),
});
const disable2FASchema = z.object({
  password: z.string().min(1).max(128),
  totpCode: z.string().regex(/^[0-9]{6}$/),
});

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

function sessionContextFromReq(req: Request): authService.SessionContext {
  return {
    userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 500) || null,
    ip: req.ip ?? null,
    label: deviceLabel(req),
  };
}

router.post("/auth/login", async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const normalized = normalizePhone(body.data.phone);
  if (!normalized) {
    res.status(400).json({ error: "Validation error", message: "رقم هاتف غير صالح" });
    return;
  }

  const outcome = await authService.login(
    { phone: normalized, password: body.data.password, totpCode: body.data.totpCode },
    sessionContextFromReq(req),
  );

  switch (outcome.type) {
    case "ok":
      void recordAuditEvent(req, "auth.login.success", {
        status: 200,
        actorIdOverride: outcome.userId,
        payload: { role: outcome.role },
      });
      // Deliver the refresh token as an httpOnly cookie. It's also returned in
      // the body for one release so legacy clients keep working.
      setRefreshCookie(res, outcome.tokens.refreshToken);
      res.json({
        accessToken: outcome.tokens.accessToken,
        refreshToken: outcome.tokens.refreshToken,
        user: { id: outcome.userId, name: outcome.name, phone: outcome.phone, role: outcome.role },
      });
      return;

    case "requires2fa": {
      const partialToken = sign2FAPartialToken(outcome.partialUserId);
      res.status(200).json({ requires2FA: true, partialToken });
      return;
    }

    case "invalid_credentials":
      void recordAuditEvent(req, outcome.reason === "bad_totp" ? "auth.2fa.failed" : "auth.login.failed", {
        status: 401,
        actorIdOverride: outcome.userId,
        payload: { phone: normalized, reason: outcome.reason },
      });
      res.status(401).json({
        error: "Unauthorized",
        message:
          outcome.reason === "bad_totp" ? "رمز التحقق غير صحيح" : "رقم الهاتف أو كلمة المرور غير صحيحة",
      });
      return;

    case "locked": {
      void recordAuditEvent(req, "auth.login.locked", {
        status: 423,
        actorIdOverride: outcome.userId,
        payload: { reason: "account_locked", minutesRemaining: outcome.minutesRemaining },
      });
      res.status(423).json({
        error: "Locked",
        message: `الحساب مغلق مؤقتاً بسبب محاولات دخول فاشلة. حاول بعد ${outcome.minutesRemaining} دقيقة`,
      });
      return;
    }

    case "locked_now":
      void recordAuditEvent(req, "auth.login.locked_now", {
        status: 423,
        actorIdOverride: outcome.userId,
        payload: { lockedUntil: outcome.lockedUntil.toISOString() },
      });
      res.status(423).json({
        error: "Locked",
        message: `تم إغلاق الحساب لمدة ${authService.LOCKOUT_POLICY.lockoutMinutes} دقيقة بسبب محاولات دخول فاشلة متكررة`,
      });
      return;

    case "validation_error":
      res.status(400).json({ error: "Validation error", message: outcome.message });
      return;
  }
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

  const outcome = await authService.verify2FA(userId, body.data.totpCode, sessionContextFromReq(req));

  switch (outcome.type) {
    case "ok":
      void recordAuditEvent(req, "auth.login.success_2fa", {
        status: 200,
        actorIdOverride: outcome.userId,
        payload: { role: outcome.role },
      });
      setRefreshCookie(res, outcome.tokens.refreshToken);
      res.json({
        accessToken: outcome.tokens.accessToken,
        refreshToken: outcome.tokens.refreshToken,
        user: { id: outcome.userId, name: outcome.name, phone: outcome.phone, role: outcome.role },
      });
      return;
    case "session_expired":
      res.status(401).json({ error: "Unauthorized", message: "انتهت جلسة التحقق" });
      return;
    case "locked":
      res.status(423).json({ error: "Locked", message: "الحساب مغلق مؤقتاً" });
      return;
    case "invalid_code":
      void recordAuditEvent(req, "auth.2fa.failed", { status: 401, actorIdOverride: outcome.userId });
      res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
      return;
    case "locked_now":
      void recordAuditEvent(req, "auth.2fa.locked_now", { status: 423, actorIdOverride: outcome.userId });
      res.status(423).json({
        error: "Locked",
        message: `تم إغلاق الحساب لمدة ${authService.LOCKOUT_POLICY.lockoutMinutes} دقيقة`,
      });
      return;
  }
});

router.post("/auth/refresh", async (req, res) => {
  // Read the refresh token from the httpOnly cookie first, falling back to the
  // request body for legacy clients that still post it.
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) {
    res.status(401).json({ error: "Unauthorized", message: "Refresh token required" });
    return;
  }
  const outcome = await authService.rotateRefreshToken(refreshToken, sessionContextFromReq(req));
  switch (outcome.type) {
    case "ok":
      // Rotate the cookie to the freshly-minted refresh token. The body still
      // carries it for one release so legacy clients keep working.
      setRefreshCookie(res, outcome.tokens.refreshToken);
      res.json({
        accessToken: outcome.tokens.accessToken,
        refreshToken: outcome.tokens.refreshToken,
        user: null,
      });
      return;
    case "reuse_detected":
      void recordAuditEvent(req, "auth.refresh.reuse_detected", {
        status: 401,
        actorIdOverride: outcome.userId,
      });
      // Clear the cookie so a compromised/rotated token isn't resent on every
      // page load.
      clearRefreshCookie(res);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
    case "expired":
    case "invalid":
      clearRefreshCookie(res);
      res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
      return;
  }
});

router.post("/auth/logout", async (req, res) => {
  // The token rides in the cookie now; still accept a body token for legacy
  // clients. Revoke it server-side, then clear the cookie either way.
  const refreshToken = readRefreshTokenFromRequest(req);
  await authService.logout(refreshToken);
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
  res.json({ ...user, role: authService.normalizeRole(user.role) });
});

router.post("/auth/change-password", authenticate, async (req, res) => {
  const body = changePasswordSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Validation error",
      message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل",
    });
    return;
  }
  const outcome = await authService.changePassword(
    req.user!.userId,
    body.data.currentPassword,
    body.data.newPassword,
  );
  switch (outcome.type) {
    case "ok":
      res.json({ success: true, message: "تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً" });
      return;
    case "user_not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "wrong_current_password":
      res.status(400).json({ error: "Bad request", message: "كلمة المرور الحالية غير صحيحة" });
      return;
  }
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
  const outcome = await authService.updatePhone(req.user!.userId, normalizedNewPhone, body.data.password);
  switch (outcome.type) {
    case "ok":
      res.json({ success: true, message: "تم تحديث رقم الهاتف بنجاح. يرجى تسجيل الدخول مجدداً" });
      return;
    case "user_not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "wrong_password":
      res.status(400).json({ error: "Bad request", message: "كلمة المرور غير صحيحة" });
      return;
    case "phone_taken":
      res.status(409).json({ error: "Conflict", message: "رقم الهاتف مستخدم بالفعل" });
      return;
  }
});

// ── 2FA setup / enable / disable ─────────────────────────────────────────────

router.post("/auth/2fa/setup", authenticate, async (req, res) => {
  const outcome = await authService.start2FASetup(req.user!.userId);
  switch (outcome.type) {
    case "ok":
      res.json({ secret: outcome.secret, otpauthUrl: outcome.otpauthUrl });
      return;
    case "user_not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "already_enabled":
      res.status(409).json({ error: "Conflict", message: "التحقق بخطوتين مفعّل بالفعل" });
      return;
  }
});

router.post("/auth/2fa/enable", authenticate, async (req, res) => {
  const body = enable2FASchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "رمز التحقق غير صالح" });
    return;
  }
  const outcome = await authService.enable2FA(req.user!.userId, body.data.totpCode);
  switch (outcome.type) {
    case "ok":
      void recordAuditEvent(req, "auth.2fa.enabled", { status: 200 });
      res.json({ success: true });
      return;
    case "setup_not_started":
      res.status(400).json({ error: "Bad request", message: "ابدأ الإعداد أولاً" });
      return;
    case "already_enabled":
      res.status(409).json({ error: "Conflict", message: "التحقق بخطوتين مفعّل بالفعل" });
      return;
    case "invalid_code":
      res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
      return;
  }
});

router.post("/auth/2fa/disable", authenticate, async (req, res) => {
  const body = disable2FASchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const outcome = await authService.disable2FA(req.user!.userId, body.data.password, body.data.totpCode);
  switch (outcome.type) {
    case "ok":
      void recordAuditEvent(req, "auth.2fa.disabled", { status: 200 });
      res.json({ success: true });
      return;
    case "user_not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "wrong_password":
      res.status(401).json({ error: "Unauthorized", message: "كلمة المرور غير صحيحة" });
      return;
    case "invalid_code":
      res.status(401).json({ error: "Unauthorized", message: "رمز التحقق غير صحيح" });
      return;
  }
});

export default router;
