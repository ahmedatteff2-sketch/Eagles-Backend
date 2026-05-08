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

const ACCESS_SECRET = getSecret("JWT_ACCESS_SECRET", "dev_access_secret_CHANGE_IN_PROD_32chars!!");
const REFRESH_SECRET = getSecret("JWT_REFRESH_SECRET", "dev_refresh_secret_CHANGE_IN_PROD_32chars!!");

const ACCESS_TTL: jwt.SignOptions["expiresIn"] = (process.env.JWT_ACCESS_TTL ?? "15m") as jwt.SignOptions["expiresIn"];
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, algorithm: "HS256" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` as jwt.SignOptions["expiresIn"], algorithm: "HS256" });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DAYS);
  return d;
}
