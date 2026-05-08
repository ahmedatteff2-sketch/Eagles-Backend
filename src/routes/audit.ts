import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const querySchema = z.object({
  // Pagination — capped at 200/page so the response stays bounded even when
  // the admin filters very loosely.
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  // Optional filters
  actorId: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(128).optional(),
  targetType: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(64).optional(),
  // ISO date strings
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get("/audit", authenticate, requireAdmin, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: "Invalid query parameters" });
    return;
  }
  const q = parsed.data;
  const conditions: SQL[] = [];
  if (q.actorId) conditions.push(eq(auditLogsTable.actorId, q.actorId));
  if (q.action) conditions.push(eq(auditLogsTable.action, q.action));
  if (q.targetType) conditions.push(eq(auditLogsTable.targetType, q.targetType));
  if (q.targetId) conditions.push(eq(auditLogsTable.targetId, q.targetId));
  if (q.from) conditions.push(gte(auditLogsTable.createdAt, new Date(q.from)));
  if (q.to) conditions.push(lte(auditLogsTable.createdAt, new Date(q.to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(whereClause)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(q.limit)
    .offset(q.offset);

  // Total count for pagination — separate query so the result shape stays a
  // simple array. drizzle's count() helper builds the canonical COUNT(*).
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogsTable)
    .where(whereClause);

  res.json({ rows, total: count, limit: q.limit, offset: q.offset });
});

export default router;
