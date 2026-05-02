import jwt from "jsonwebtoken";
import { AuthPayload } from "../middlewares/auth.js";
import { logger } from "./logger.js";

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
  return val;
}

const ACCESS_SECRET = getSecret("JWT_ACCESS_SECRET", "dev_access_secret_CHANGE_IN_PROD_32chars!!");
const REFRESH_SECRET = getSecret("JWT_REFRESH_SECRET", "dev_refresh_secret_CHANGE_IN_PROD_32chars!!");

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "8h", algorithm: "HS256" });
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d", algorithm: "HS256" });
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}
