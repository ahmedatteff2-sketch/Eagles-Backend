import jwt from "jsonwebtoken";
import { AuthPayload } from "../middlewares/auth.js";
import { logger } from "./logger.js";

const MIN_SECRET_LENGTH = 32;

function getSecret(envVar: string, fallback: string): string {
  const val = process.env[envVar];
  if (!val) {
    if (process.env.NODE_ENV === "production") {
      logger.error(`Missing required env var: ${envVar}`);
      process.exit(1);
    }
    logger.warn(`${envVar} not set — using insecure dev fallback`);
    return fallback;
  }
  if (val.length < MIN_SECRET_LENGTH) {
    if (process.env.NODE_ENV === "production") {
      logger.error(`${envVar} must be at least ${MIN_SECRET_LENGTH} characters`);
      process.exit(1);
    }
    logger.warn(`${envVar} is shorter than ${MIN_SECRET_LENGTH} characters — insecure for production`);
  }
  return val;
}

/**
 * Parse a comma-separated list of fallback verification secrets. Used during
 * key rotation: signing always happens with the primary secret, but verify is
 * tried against `[primary, ...fallbacks]` so previously-issued tokens stay
 * valid for the duration of the rotation window. Empty / missing-env returns
 * an empty array.
 */
function getFallbackSecrets(envVar: string): string[] {
  const val = process.env[envVar];
  if (!val) return [];
  return val
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      if (s.length === 0) return false;
      if (s.length < MIN_SECRET_LENGTH) {
        logger.warn(
          { envVar, length: s.length },
          `Fallback secret in ${envVar} is shorter than ${MIN_SECRET_LENGTH} characters — ignoring`,
        );
        return false;
      }
      return true;
    });
}

const ACCESS_SECRET = getSecret("JWT_ACCESS_SECRET", "dev_access_secret_CHANGE_IN_PROD_32chars!!");
const REFRESH_SECRET = getSecret("JWT_REFRESH_SECRET", "dev_refresh_secret_CHANGE_IN_PROD_32chars!!");

const ACCESS_VERIFY_SECRETS: string[] = [ACCESS_SECRET, ...getFallbackSecrets("JWT_ACCESS_SECRETS_FALLBACK")];
const REFRESH_VERIFY_SECRETS: string[] = [REFRESH_SECRET, ...getFallbackSecrets("JWT_REFRESH_SECRETS_FALLBACK")];

const ACCESS_TTL: jwt.SignOptions["expiresIn"] = (process.env.JWT_ACCESS_TTL ?? "15m") as jwt.SignOptions["expiresIn"];

// `Number("30d")` is NaN, which would make `signRefreshToken` blow up at
// runtime ("NaNd" expiry → jwt.sign throws → every login 500s). Guard with
// a finite-positive check and fall back to the default rather than booting
// the server in a broken state.
const DEFAULT_REFRESH_TTL_DAYS = 30;
function parseRefreshTtlDays(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_REFRESH_TTL_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    logger.warn(
      { JWT_REFRESH_TTL_DAYS: raw, defaultDays: DEFAULT_REFRESH_TTL_DAYS },
      "JWT_REFRESH_TTL_DAYS is not a positive number — falling back to default",
    );
    return DEFAULT_REFRESH_TTL_DAYS;
  }
  return Math.floor(parsed);
}
const REFRESH_TTL_DAYS = parseRefreshTtlDays(process.env.JWT_REFRESH_TTL_DAYS);

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, algorithm: "HS256" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` as jwt.SignOptions["expiresIn"], algorithm: "HS256" });
}

/**
 * Try to verify the token against each configured secret in order, returning
 * on the first success. Throws the *first* failure if every secret rejects
 * the token — this means errors propagated to callers stay consistent with
 * the single-secret pre-rotation behavior.
 */
function verifyWithRotation(token: string, secrets: string[]): AuthPayload {
  let firstError: unknown;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, { algorithms: ["HS256"] }) as AuthPayload;
    } catch (err) {
      if (firstError === undefined) firstError = err;
    }
  }
  throw firstError ?? new Error("No JWT secret configured");
}

export function verifyAccessToken(token: string): AuthPayload {
  return verifyWithRotation(token, ACCESS_VERIFY_SECRETS);
}

export function verifyRefreshToken(token: string): AuthPayload {
  return verifyWithRotation(token, REFRESH_VERIFY_SECRETS);
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DAYS);
  return d;
}

/**
 * Short-lived "partial" token issued after step-1 of a 2FA login (correct
 * password, but still need a valid TOTP code). Signed with the access secret
 * with a tight 5-minute TTL so it can't be reused for normal API calls — the
 * `/auth/2fa/verify` route checks `purpose === "2fa"` before completing the
 * login.
 */
const TWO_FA_PARTIAL_TTL_SECONDS = 300;
export interface TwoFAPartialPayload {
  userId: string;
  purpose: "2fa";
}
export function sign2FAPartialToken(userId: string): string {
  const payload: TwoFAPartialPayload = { userId, purpose: "2fa" };
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: TWO_FA_PARTIAL_TTL_SECONDS,
    algorithm: "HS256",
  });
}
export function verify2FAPartialToken(token: string): TwoFAPartialPayload {
  for (const secret of ACCESS_VERIFY_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as TwoFAPartialPayload;
      if (decoded.purpose !== "2fa") throw new Error("Invalid token purpose");
      return decoded;
    } catch {
      // try next secret
    }
  }
  throw new Error("Invalid 2FA partial token");
}
