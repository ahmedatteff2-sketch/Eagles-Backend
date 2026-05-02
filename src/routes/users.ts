import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, memberSubscriptionsTable, subscriptionsTable, checkinsTable, paymentsTable } from "@workspace/db/schema";
import { eq, ilike, or, count, sum, desc, and, gte } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parsePagination } from "../lib/params.js";
import { z } from "zod";

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2).max(100).transform(s => s.trim()),
  phone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/).transform(s => s.trim()),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "trainer", "member"]).default("member"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).transform(s => s.trim()).optional(),
  phone: z.string().min(5).max(20).regex(/^[0-9+\-\s()]{5,20}$/).transform(s => s.trim()).optional(),
  role: z.enum(["admin", "trainer", "member"]).optional(),
});

router.get("/users", authenticate, requireAdmin, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit, 100);
  const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : undefined;

  try {
    let query = db.select().from(usersTable).where(eq(usersTable.role, "member"));
    if (search) {
      query = db.select().from(usersTable).where(
        and(eq(usersTable.role, "member"), or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.phone, `%${search}%`)))
      ) as typeof query;
    }

    const users = await query.orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const [totalRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "member"));

    // Single JOIN query for subscriptions (avoids N+1)
    const userIds = users.map(u => u.id);
    let subsMap: Record<number, any> = {};
    if (userIds.length > 0) {
      const allSubs = await db
        .select({
          userId: memberSubscriptionsTable.userId,
          id: memberSubscriptionsTable.id,
          subscriptionId: memberSubscriptionsTable.subscriptionId,
          startDate: memberSubscriptionsTable.startDate,
          endDate: memberSubscriptionsTable.endDate,
          status: memberSubscriptionsTable.status,
          subName: subscriptionsTable.name,
          subDuration: subscriptionsTable.duration,
          subPrice: subscriptionsTable.price,
          subId: subscriptionsTable.id,
        })
        .from(memberSubscriptionsTable)
        .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
        .orderBy(desc(memberSubscriptionsTable.createdAt));

      for (const s of allSubs) {
        if (!subsMap[s.userId]) {
          subsMap[s.userId] = {
            id: s.id,
            userId: s.userId,
            subscriptionId: s.subscriptionId,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status,
            subscription: { id: s.subId, name: s.subName, duration: s.subDuration, price: s.subPrice },
          };
        }
      }
    }

    const usersWithSubs = users.map(u => {
      const { password: _, ...safe } = u;
      return { ...safe, currentSubscription: subsMap[u.id] ?? null };
    });

    res.json({ data: usersWithSubs, total: totalRow?.count ?? 0, page, limit });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأعضاء" });
  }
});

router.post("/users", authenticate, requireAdmin, async (req, res) => {
  const body = createUserSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, body.data.phone)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "رقم الهاتف مستخدم بالفعل" });
      return;
    }
    const hashed = await bcrypt.hash(body.data.password, 10);
    const [user] = await db.insert(usersTable).values({ ...body.data, password: hashed }).returning();
    const { password: _, ...safe } = user;
    res.status(201).json(safe);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة العضو" });
  }
});

router.get("/users/:userId", authenticate, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  if (req.user!.role !== "admin" && req.user!.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [currentSubscription] = await db
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

    const recentCheckins = await db.select().from(checkinsTable).where(eq(checkinsTable.userId, userId)).orderBy(desc(checkinsTable.date)).limit(5);
    const [paySum] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.userId, userId));

    const { password: _, ...safe } = user;
    res.json({ ...safe, currentSubscription: currentSubscription ?? null, recentCheckins, totalPayments: Number(paySum?.total ?? 0) });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب بيانات العضو" });
  }
});

router.put("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  const body = updateUserSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [user] = await db.update(usersTable).set(body.data).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  try {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true, message: "تم حذف العضو" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

router.post("/users/:userId/reset-password", authenticate, requireAdmin, async (req, res) => {
  const userId = parseId(req.params.userId, res, "معرّف العضو");
  if (!userId) return;

  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 128) {
    res.status(400).json({ error: "Validation error", message: "كلمة المرور يجب أن تكون بين 6 و 128 حرف" });
    return;
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, userId));
    res.json({ success: true, message: "تم إعادة تعيين كلمة المرور" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

export default router;
