import { Response } from "express";

/**
 * Safely parse a URL param or query value as a PostgreSQL-safe integer.
 * Returns null and sends a 400 response if invalid.
 */
export function parseId(raw: string | string[] | undefined, res: Response, label = "المعرف"): number | null {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(str);
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) {
    res.status(400).json({ error: "Bad request", message: `${label} غير صالح` });
    return null;
  }
  return n;
}

/**
 * Safely extract a non-empty user ID from a URL param or query value.
 * User IDs are opaque strings (UUIDs from Prisma's @default(cuid())).
 * Returns null and sends a 400 response if invalid.
 */
export function parseUserId(
  raw: string | string[] | undefined,
  res: Response,
  label = "معرّف العضو",
): string | null {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (typeof str !== "string") {
    res.status(400).json({ error: "Bad request", message: `${label} غير صالح` });
    return null;
  }
  const trimmed = str.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    res.status(400).json({ error: "Bad request", message: `${label} غير صالح` });
    return null;
  }
  return trimmed;
}

/** Clamp page/limit to safe values */
export function parsePagination(
  rawPage: unknown,
  rawLimit: unknown,
  maxLimit = 100,
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(rawLimit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
