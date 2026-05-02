import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, memberSubscriptionsTable, paymentsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { z } from "zod";

const router = Router();

const subscriptionSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  duration: z.number().int().min(1).max(3650),
  price: z.number().min(0).max(1_000_000),
});

const assignSchema = z.object({
  userId: z.number().int().min(1).max(2_147_483_647),
  subscriptionId: z.number().int().min(1).max(2_147_483_647),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح (YYYY-MM-DD)"),
  paymentAmount: z.number().min(0).max(1_000_000).optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});

router.get("/subscriptions", authenticate, async (_req, res) => {
  try {
    const subs = await db.select().from(subscriptionsTable).orderBy(subscriptionsTable.name);
    res.json(subs);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الاشتراكات" });
  }
});

router.post("/subscriptions", authenticate, requireAdmin, async (req, res) => {
  const body = subscriptionSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [sub] = await db.insert(subscriptionsTable).values({
      name: body.data.name,
      duration: body.data.duration,
      price: String(body.data.price),
    }).returning();
    res.status(201).json(sub);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة الاشتراك" });
  }
});

router.put("/subscriptions/:subscriptionId", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.subscriptionId, res, "معرّف الاشتراك");
  if (!id) return;

  const body = subscriptionSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [sub] = await db.update(subscriptionsTable).set({
      name: body.data.name,
      duration: body.data.duration,
      price: String(body.data.price),
    }).where(eq(subscriptionsTable.id, id)).returning();
    if (!sub) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(sub);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/subscriptions/:subscriptionId", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.subscriptionId, res, "معرّف الاشتراك");
  if (!id) return;

  try {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, id));
    res.json({ success: true, message: "تم حذف الاشتراك" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

// Member subscriptions
router.post("/member-subscriptions", authenticate, requireAdmin, async (req, res) => {
  const body = assignSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const { userId, subscriptionId, startDate, paymentAmount, paymentMethod } = body.data;
  try {
    const [plan] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
    if (!plan) {
      res.status(404).json({ error: "Not found", message: "خطة الاشتراك غير موجودة" });
      return;
    }
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      res.status(400).json({ error: "Validation error", message: "تاريخ البداية غير صحيح" });
      return;
    }
    const end = new Date(start);
    end.setDate(end.getDate() + plan.duration);
    const endDate = end.toISOString().split("T")[0];

    const [ms] = await db.insert(memberSubscriptionsTable).values({
      userId, subscriptionId, startDate, endDate, status: "active",
    }).returning();

    if (paymentAmount && paymentAmount > 0) {
      await db.insert(paymentsTable).values({
        userId,
        amount: String(paymentAmount),
        date: startDate,
        method: paymentMethod ?? "cash",
      });
    }

    res.status(201).json({ ...ms, subscription: plan });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تعيين الاشتراك" });
  }
});

router.get("/member-subscriptions/:userId/current", authenticate, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  if (req.user!.role !== "admin" && req.user!.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const [sub] = await db
      .select({
        id: memberSubscriptionsTable.id,
        userId: memberSubscriptionsTable.userId,
        subscriptionId: memberSubscriptionsTable.subscriptionId,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        subscription: {
          id: subscriptionsTable.id,
          name: subscriptionsTable.name,
          duration: subscriptionsTable.duration,
          price: subscriptionsTable.price,
        },
      })
      .from(memberSubscriptionsTable)
      .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(eq(memberSubscriptionsTable.userId, userId))
      .orderBy(desc(memberSubscriptionsTable.createdAt))
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: "Not found", message: "لا يوجد اشتراك" });
      return;
    }
    res.json(sub);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الاشتراك" });
  }
});

router.get("/member-subscriptions/:userId/history", authenticate, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  if (req.user!.role !== "admin" && req.user!.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const subs = await db
      .select({
        id: memberSubscriptionsTable.id,
        userId: memberSubscriptionsTable.userId,
        subscriptionId: memberSubscriptionsTable.subscriptionId,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        subscription: {
          id: subscriptionsTable.id,
          name: subscriptionsTable.name,
          duration: subscriptionsTable.duration,
          price: subscriptionsTable.price,
        },
      })
      .from(memberSubscriptionsTable)
      .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(eq(memberSubscriptionsTable.userId, userId))
      .orderBy(desc(memberSubscriptionsTable.createdAt));
    res.json(subs);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجل" });
  }
});

export default router;
