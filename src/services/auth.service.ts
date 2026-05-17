/**
 * Auth service layer. Implements the *business* logic for login, refresh,
 * lockout, password change, and 2FA — without any HTTP / Express knowledge.
 *
 * Returns plain result objects (or throws domain errors) so the route
 * handlers in `src/routes/auth.ts` can map them to HTTP responses without
 * having to know how the underlying tables are organized.
 */
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { authenticator } from "otplib";
import { logger } from "../lib/logger.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from "../lib/jwt.js";
import type { Role } from "../middlewares/auth.js";
import * as usersRepo from "../repositories/users.repo.js";
import * as refreshRepo from "../repositories/refresh-tokens.repo.js";

// otplib defaults are TOTP / SHA1 / 6 digits / 30s — matches Google
// Authenticator, Authy, 1Password, and every standard authenticator app.
authenticator.options = { window: 1 };

// Pre-computed bcrypt hash used to keep login timing constant when the phone
// does not exist. Generated once at module init with the same cost as
// production hashes (12) so timing matches a real comparison.
const TIMING_DUMMY_HASH = bcrypt.hashSync("__timing_attack_dummy__", 12);

// Account-lockout policy. Both env-tunable; sane defaults are 10 attempts /
// 30 minutes — long enough to deter brute force, short enough that a
// legitimate user can call the gym to wait it out.
const MAX_FAILED_ATTEMPTS = (() => {
  const raw = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS);
  return Number.isFinite(raw) && raw >= 3 ? Math.floor(raw) : 10;
})();
const LOCKOUT_MINUTES = (() => {
  const raw = Number(process.env.LOGIN_LOCKOUT_MINUTES);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 30;
})();

export const LOCKOUT_POLICY = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockoutMinutes: LOCKOUT_MINUTES,
} as const;

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeRole(raw: string): Role {
  const r = raw.toLowerCase();
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  return "member";
}

export function verifyTotp(secret: string, code: string): boolean {
  return authenticator.check(code, secret);
}

/**
 * Per-session metadata recorded against the issued refresh token. Routes
 * pass this in so service code never has to introspect Express requests.
 */
export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
  label: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokenPair(
  userId: string,
  role: Role,
  ctx: SessionContext,
): Promise<TokenPair> {
  const payload = { userId, role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await refreshRepo.deleteExpiredForUser(userId);
  await refreshRepo.insertRefreshToken({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
    label: ctx.label,
    lastUsedAt: new Date(),
  });

  return { accessToken, refreshToken };
}

/**
 * `LoginOutcome` describes everything a route handler needs to translate
 * the result of a login attempt into an HTTP response — without having to
 * peek inside the user row itself. Each variant is mutually exclusive.
 */
export type LoginOutcome =
  | { type: "ok"; userId: string; role: Role; name: string; phone: string; tokens: TokenPair }
  | { type: "requires2fa"; partialUserId: string }
  | { type: "invalid_credentials"; userId?: string; reason: "no_such_user" | "bad_password" | "bad_totp" }
  | { type: "locked"; userId: string; lockedUntil: Date; minutesRemaining: number }
  | { type: "locked_now"; userId: string; lockedUntil: Date }
  | { type: "validation_error"; message: string };

export interface LoginInput {
  phone: string; // already normalized by the route layer
  password: string;
  totpCode?: string;
}

/**
 * Authenticate a user by phone+password (and TOTP if enabled). Returns a
 * tagged outcome the route can translate to JSON; never throws on a normal
 * "wrong credentials" path.
 */
export async function login(input: LoginInput, ctx: SessionContext): Promise<LoginOutcome> {
  const user = await usersRepo.findUserByPhone(input.phone);
  if (!user) {
    // Constant-time: still hit bcrypt so the timing channel doesn't leak
    // whether the phone exists.
    await bcrypt.compare(input.password, TIMING_DUMMY_HASH);
    return { type: "invalid_credentials", reason: "no_such_user" };
  }

  // Lockout check FIRST — don't reveal whether the password would have been
  // correct while the account is frozen.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { type: "locked", userId: user.id, lockedUntil: user.lockedUntil, minutesRemaining };
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordOk) {
    const lockedUntil = await registerFailedAttempt(user.id);
    if (lockedUntil) {
      return { type: "locked_now", userId: user.id, lockedUntil };
    }
    return { type: "invalid_credentials", userId: user.id, reason: "bad_password" };
  }

  // Password OK. If 2FA is enabled, require a TOTP code before completing
  // the login. The route is responsible for issuing the partial token so we
  // don't tangle the JWT format into this layer.
  if (user.totpEnabled && user.totpSecret) {
    if (!input.totpCode) {
      return { type: "requires2fa", partialUserId: user.id };
    }
    if (!verifyTotp(user.totpSecret, input.totpCode)) {
      const lockedUntil = await registerFailedAttempt(user.id);
      if (lockedUntil) {
        return { type: "locked_now", userId: user.id, lockedUntil };
      }
      return { type: "invalid_credentials", userId: user.id, reason: "bad_totp" };
    }
  }

  await usersRepo.clearFailedLoginAttempts(user.id);
  const role = normalizeRole(user.role);
  const tokens = await issueTokenPair(user.id, role, ctx);
  return {
    type: "ok",
    userId: user.id,
    role,
    name: user.name,
    phone: user.phone,
    tokens,
  };
}

/**
 * Bumps the failed-attempt counter for `userId`. Returns the lock expiry
 * if the latest attempt crossed the threshold, otherwise `null`.
 */
export async function registerFailedAttempt(userId: string): Promise<Date | null> {
  const current = await usersRepo.getFailedLoginCount(userId);
  const next = current + 1;
  if (next >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    await usersRepo.setFailedLoginAttempts(userId, next, lockedUntil);
    return lockedUntil;
  }
  await usersRepo.setFailedLoginAttempts(userId, next, null);
  return null;
}

/**
 * Verify a TOTP code for the 2FA-verify step (after a successful step-1
 * password check). Returns either the issued tokens or a tagged failure.
 */
export type Verify2FAOutcome =
  | { type: "ok"; userId: string; role: Role; name: string; phone: string; tokens: TokenPair }
  | { type: "session_expired" }
  | { type: "locked" }
  | { type: "invalid_code"; userId: string }
  | { type: "locked_now"; userId: string };

export async function verify2FA(userId: string, code: string, ctx: SessionContext): Promise<Verify2FAOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return { type: "session_expired" };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { type: "locked" };
  }
  if (!verifyTotp(user.totpSecret, code)) {
    const lockedUntil = await registerFailedAttempt(user.id);
    if (lockedUntil) return { type: "locked_now", userId: user.id };
    return { type: "invalid_code", userId: user.id };
  }
  await usersRepo.clearFailedLoginAttempts(user.id);
  const role = normalizeRole(user.role);
  const tokens = await issueTokenPair(user.id, role, ctx);
  return { type: "ok", userId: user.id, role, name: user.name, phone: user.phone, tokens };
}

/**
 * Refresh-token rotation with reuse detection. If the supplied token is
 * known but already revoked (or simply not in the DB), we treat that as
 * compromise: revoke every refresh token for the user so the legitimate
 * client is forced to re-authenticate, and the attacker's stolen tokens
 * are dead too.
 */
export type RefreshOutcome =
  | { type: "ok"; tokens: TokenPair }
  | { type: "reuse_detected"; userId: string }
  | { type: "expired" }
  | { type: "invalid" };

export async function rotateRefreshToken(refreshToken: string, ctx: SessionContext): Promise<RefreshOutcome> {
  let payload: { userId: string; role: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return { type: "invalid" };
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await refreshRepo.findByHash(tokenHash);

  if (!stored) {
    // Valid signature but not in DB — token was already consumed once.
    logger.warn({ userId: payload.userId }, "Refresh token reuse detected (token not in DB)");
    await refreshRepo.revokeAllForUser(payload.userId);
    return { type: "reuse_detected", userId: payload.userId };
  }

  if (stored.revoked) {
    logger.warn({ userId: payload.userId }, "Refresh token reuse detected — revoking all tokens");
    await refreshRepo.revokeAllForUser(payload.userId);
    return { type: "reuse_detected", userId: payload.userId };
  }

  if (stored.expiresAt < new Date()) {
    await refreshRepo.revokeByHash(tokenHash);
    return { type: "expired" };
  }

  // Rotation: revoke the just-presented token and mint a new pair.
  await refreshRepo.revokeByHash(tokenHash);
  const tokens = await issueTokenPair(payload.userId, normalizeRole(payload.role), ctx);
  return { type: "ok", tokens };
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  await refreshRepo.revokeByHash(hashRefreshToken(refreshToken));
}

export type ChangePasswordOutcome =
  | { type: "ok" }
  | { type: "user_not_found" }
  | { type: "wrong_current_password" };

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user) return { type: "user_not_found" };
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return { type: "wrong_current_password" };
  const hashed = await bcrypt.hash(newPassword, 12);
  await usersRepo.setPasswordHash(userId, hashed);
  // Password is a credential — invalidate every active session.
  await refreshRepo.revokeAllForUser(userId);
  return { type: "ok" };
}

export type UpdatePhoneOutcome =
  | { type: "ok" }
  | { type: "user_not_found" }
  | { type: "wrong_password" }
  | { type: "phone_taken" };

export async function updatePhone(
  userId: string,
  newPhone: string,
  password: string,
): Promise<UpdatePhoneOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user) return { type: "user_not_found" };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { type: "wrong_password" };
  const conflict = await usersRepo.findOtherUserWithPhone(newPhone, userId);
  if (conflict) return { type: "phone_taken" };
  await usersRepo.setPhone(userId, newPhone);
  // Phone is a credential — invalidate every active session.
  await refreshRepo.revokeAllForUser(userId);
  return { type: "ok" };
}

export type Setup2FAOutcome =
  | { type: "ok"; secret: string; otpauthUrl: string }
  | { type: "user_not_found" }
  | { type: "already_enabled" };

export async function start2FASetup(userId: string): Promise<Setup2FAOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user) return { type: "user_not_found" };
  if (user.totpEnabled) return { type: "already_enabled" };
  const secret = authenticator.generateSecret();
  await usersRepo.setTotpSecret(userId, secret);
  const issuer = "Eagle Gym";
  const accountName = user.phone || user.name;
  const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);
  return { type: "ok", secret, otpauthUrl };
}

export type Enable2FAOutcome =
  | { type: "ok" }
  | { type: "setup_not_started" }
  | { type: "already_enabled" }
  | { type: "invalid_code" };

export async function enable2FA(userId: string, code: string): Promise<Enable2FAOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user || !user.totpSecret) return { type: "setup_not_started" };
  if (user.totpEnabled) return { type: "already_enabled" };
  if (!verifyTotp(user.totpSecret, code)) return { type: "invalid_code" };
  await usersRepo.setTotpEnabled(userId, true);
  return { type: "ok" };
}

export type Disable2FAOutcome =
  | { type: "ok" }
  | { type: "user_not_found" }
  | { type: "wrong_password" }
  | { type: "invalid_code" };

export async function disable2FA(
  userId: string,
  password: string,
  code: string,
): Promise<Disable2FAOutcome> {
  const user = await usersRepo.findUserById(userId);
  if (!user) return { type: "user_not_found" };
  if (!(await bcrypt.compare(password, user.passwordHash))) return { type: "wrong_password" };
  if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) return { type: "invalid_code" };
  await usersRepo.setTotpEnabled(userId, false);
  return { type: "ok" };
}
