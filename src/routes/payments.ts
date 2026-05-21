import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseUserId, parsePagination } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

const paymentSchema = z.object({
  userId: z.string().min(1).max(64),
  amount: z.number().positive().max(1_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح"),
  method: z.enum(["cash", "card", "transfer"]),
});

router.get("/payments", authenticate, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit, 100);
  // Resolve the target user:
  //   - explicit `?userId=...` → use it, but enforce admin-or-self below
  //   - no `?userId` from a member → restrict to their own payments
  //   - no `?userId` from an admin → list everyone's payments
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : req.user!.role === "member"
      ? req.user!.userId
      : undefined;

  if (req.query.userId && targetUserId === null) return;

  // Access control. Without this, a logged-in member could pass
  // ?userId=<some_other_member_id> and read another user's payment history.
  // Members may only see their own; trainers and admins may see any user.
  if (targetUserId && req.user!.role === "member" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const conditions = [];
    if (targetUserId) conditions.push(eq(paymentsTable.userId, targetUserId));

    const payments = await db
      .select({
        id: paymentsTable.id,
        userId: paymentsTable.userId,
        amount: paymentsTable.amount,
        date: paymentsTable.date,
        method: paymentsTable.method,
        userName: usersTable.name,
      })
      .from(paymentsTable)
      .innerJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentsTable.date))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: count() })
      .from(paymentsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ data: payments, total: totalRow?.count ?? 0, page, limit });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب المدفوعات" });
  }
});

router.post("/payments", authenticate, requireAdmin, async (req, res) => {
  const body = paymentSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [payment] = await db
      .insert(paymentsTable)
      .values({
        userId: body.data.userId,
        amount: String(body.data.amount),
        date: body.data.date,
        method: body.data.method,
      })
      .returning();
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, payment.userId))
      .limit(1);
    res.status(201).json({ ...payment, userName: user?.name ?? "" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تسجيل الدفعة" });
  }
});

export default router;
