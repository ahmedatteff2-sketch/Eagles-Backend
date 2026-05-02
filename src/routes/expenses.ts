import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db/schema";
import { eq, desc, sum, gte, lte, and } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parsePagination } from "../lib/params.js";
import { z } from "zod";

const router = Router();

const expenseSchema = z.object({
  description: z.string().min(1).max(300),
  amount: z.number().positive().max(10_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["rent", "utilities", "salaries", "equipment", "maintenance", "marketing", "other"]).default("other"),
  notes: z.string().max(500).optional(),
});

router.get("/expenses", authenticate, requireAdmin, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit, 100);
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [];
  if (from) conditions.push(gte(expensesTable.date, from));
  if (to) conditions.push(lte(expensesTable.date, to));

  try {
    const expenses = await db
      .select()
      .from(expensesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expensesTable.date))
      .limit(limit)
      .offset(offset);

    const [totalAmountRow] = await db
      .select({ total: sum(expensesTable.amount) })
      .from(expensesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      data: expenses,
      total: expenses.length,
      totalAmount: Number(totalAmountRow?.total ?? 0),
      page,
      limit,
    });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب المصاريف" });
  }
});

router.post("/expenses", authenticate, requireAdmin, async (req, res) => {
  const body = expenseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [expense] = await db.insert(expensesTable).values({
      ...body.data,
      amount: String(body.data.amount),
    }).returning();
    res.status(201).json(expense);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة المصروف" });
  }
});

router.put("/expenses/:expenseId", authenticate, requireAdmin, async (req, res) => {
  const expenseId = parseId(req.params.expenseId, res, "معرّف المصروف");
  if (!expenseId) return;

  const body = expenseSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const updateData: Record<string, unknown> = { ...body.data };
    if (body.data.amount !== undefined) updateData.amount = String(body.data.amount);

    const [expense] = await db.update(expensesTable).set(updateData).where(eq(expensesTable.id, expenseId)).returning();
    if (!expense) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(expense);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تحديث المصروف" });
  }
});

router.delete("/expenses/:expenseId", authenticate, requireAdmin, async (req, res) => {
  const expenseId = parseId(req.params.expenseId, res, "معرّف المصروف");
  if (!expenseId) return;

  try {
    await db.delete(expensesTable).where(eq(expensesTable.id, expenseId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء حذف المصروف" });
  }
});

export default router;
