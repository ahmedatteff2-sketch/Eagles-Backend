import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";

export type Role = "admin" | "trainer" | "member";

export interface AuthPayload {
  userId: string;
  role: Role;
}

// Augment Express's Request with a typed `user` field populated by
// `authenticate()`. We extend `express-serve-static-core` (the package that
// actually declares the Request interface) instead of `namespace Express`
// so eslint's `no-namespace` rule doesn't trip — the namespace form is the
// same trick, just expressed through the deprecated TS namespace syntax.
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPayload;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    return;
  }
  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token format" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    if (!payload.userId || !payload.role) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid token payload" });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  next();
}

/**
 * Generic role-gate factory. Returns a middleware that allows the request
 * through only if `req.user.role` is one of the allowed roles.
 *
 * Use over the inline checks above when a route accepts more than one role
 * (e.g. admin OR trainer). Always layer this *after* `authenticate` so
 * `req.user` is populated.
 */
export function requireRole(...roles: Role[]) {
  return function roleGate(req: Request, res: Response, next: NextFunction): void {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * Convenience: allow admin or trainer. Trainer routes are defined this way
 * so admins can always access trainer endpoints (admin is a strict superset
 * of trainer permissions in this app).
 */
export const requireAdminOrTrainer = requireRole("admin", "trainer");

/**
 * Strict trainer-only gate. Used by `/api/trainer/*` endpoints whose
 * authorization rules ("can only see members assigned to me") would be
 * meaningless for an admin — admins already have admin endpoints.
 *
 * If product later wants admins to be able to "view as trainer", we'll
 * add a separate impersonation flow rather than loosening this gate.
 */
export const requireTrainer = requireRole("trainer");
