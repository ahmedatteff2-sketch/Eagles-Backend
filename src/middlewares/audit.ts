import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Field names whose values must NEVER reach the audit log. Matched
// case-insensitively against object keys at any depth.
const REDACT_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /\botp\b/i,
  /\btotp\b/i,
  /apikey/i,
  /api_key/i,
];

const MAX_PAYLOAD_BYTES = 8 * 1024;

function shouldRedact(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((re) => re.test(key));
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[truncated]";
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedact(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}

function truncatePayload(payload: unknown): unknown {
  try {
    const json = JSON.stringify(payload);
    if (json.length <= MAX_PAYLOAD_BYTES) return payload;
    return { _truncated: true, _originalSize: json.length, preview: json.slice(0, MAX_PAYLOAD_BYTES) };
  } catch {
    return { _unserializable: true };
  }
}

/**
 * Derive a target type + id from the matched route path. The middleware runs
 * after the response is sent, so `req.params` is fully populated and `req.route`
 * may carry the matched mount path. Falls back to first /:id-style segment.
 */
function deriveTarget(req: Request): { targetType: string | null; targetId: string | null } {
  const params = (req.params ?? {}) as Record<string, string | undefined>;
  const path = req.originalUrl.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  // /api/users/:id   → targetType "users", targetId from params.id
  // /api/subscriptions/:id/assign → targetType "subscriptions"
  // Take the segment immediately following "api" (skip "api" itself).
  let targetType: string | null = null;
  if (segments[0] === "api" && segments[1]) targetType = segments[1];
  else if (segments[0]) targetType = segments[0];
  const targetId = params.id ?? params.userId ?? params.subscriptionId ?? null;
  return { targetType, targetId };
}

/**
 * Build a free-form action label from the HTTP method + first significant path
 * segment. We deliberately avoid baking in a controller naming convention so
 * routes added later are auto-categorized without touching this file.
 */
function deriveAction(req: Request): string {
  const path = req.originalUrl.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  const apiIdx = segments.indexOf("api");
  const significant = apiIdx >= 0 ? segments.slice(apiIdx + 1) : segments;
  // Prefer "<resource>.<verb-by-method>" — drop trailing :id-like segments so
  // POST /users and POST /users/:id/reset-password yield distinct labels.
  const verbMap: Record<string, string> = {
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };
  const verb = verbMap[req.method] ?? req.method.toLowerCase();
  const tail = significant.filter((s, i) => !(i > 0 && /^[0-9a-f-]{8,}$/i.test(s))).join(".");
  return tail ? `${tail}.${verb}` : verb;
}

/**
 * Audit middleware: records a row in `audit_logs` for every state-changing
 * request that succeeded. Mounted *after* `authenticate` so `req.user` (when
 * present) is populated, but it ALSO records anonymous events (e.g. failed
 * login attempts) when the route handler emits them with `recordAuditEvent`.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  // Capture body now — by the time `res.on('finish')` fires the request has
  // been fully consumed and large/streamed bodies may have been GC'd.
  const sanitizedBody = sanitize(req.body);
  const sanitizedQuery = sanitize(req.query);

  res.on("finish", () => {
    // Skip non-2xx writes only for routes that are *expected* to fail loudly
    // (auth/login). Everything else is logged regardless of status so admins
    // can see attempted-but-rejected actions (403/404/etc).
    const status = res.statusCode;
    void writeAuditEntry({
      req,
      status,
      payload: { body: sanitizedBody, query: sanitizedQuery },
    });
  });

  next();
}

interface WriteEntryOpts {
  req: Request;
  status: number;
  payload: unknown;
  actionOverride?: string;
}

async function writeAuditEntry({ req, status, payload, actionOverride }: WriteEntryOpts): Promise<void> {
  try {
    const { targetType, targetId } = deriveTarget(req);
    const action = actionOverride ?? deriveAction(req);

    let actorName: string | null = null;
    const actorId = req.user?.userId ?? null;
    const actorRole = req.user?.role ?? null;
    if (actorId) {
      const [u] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, actorId))
        .limit(1);
      actorName = u?.name ?? null;
    }

    await db.insert(auditLogsTable).values({
      actorId,
      actorRole,
      actorName,
      action,
      targetType,
      targetId,
      method: req.method,
      path: req.originalUrl.split("?")[0].slice(0, 500),
      statusCode: status,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 500) || null,
      payload: truncatePayload(payload) as never,
    });
  } catch (err) {
    // Audit failures must never bring down the request. Log and move on.
    logger.error({ err }, "Failed to write audit log entry");
  }
}

/**
 * Manually emit an audit entry — used by the auth route to record failed
 * logins, account lockouts, 2FA enable/disable, etc., where the standard
 * middleware path doesn't carry enough context.
 */
export async function recordAuditEvent(
  req: Request,
  action: string,
  options: {
    status?: number;
    payload?: unknown;
    actorIdOverride?: string;
    targetType?: string;
    targetId?: string;
  } = {},
): Promise<void> {
  try {
    const status = options.status ?? 200;
    const sanitized = options.payload === undefined ? null : sanitize(options.payload);

    let actorId = options.actorIdOverride ?? req.user?.userId ?? null;
    let actorName: string | null = null;
    let actorRole: string | null = req.user?.role ?? null;
    if (actorId) {
      const [u] = await db
        .select({ name: usersTable.name, role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, actorId))
        .limit(1);
      actorName = u?.name ?? null;
      if (!actorRole) actorRole = u?.role ?? null;
    } else {
      actorId = null;
    }

    await db.insert(auditLogsTable).values({
      actorId,
      actorRole,
      actorName,
      action,
      targetType: options.targetType ?? null,
      targetId: options.targetId ?? null,
      method: req.method,
      path: req.originalUrl.split("?")[0].slice(0, 500),
      statusCode: status,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 500) || null,
      payload: truncatePayload(sanitized) as never,
    });
  } catch (err) {
    logger.error({ err, action }, "Failed to write manual audit event");
  }
}
