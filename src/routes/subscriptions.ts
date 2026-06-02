import { Router } from "express";
import { db } from "@workspace/db";
import {
  subscriptionsTable,
  memberSubscriptionsTable,
  paymentsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parseUserId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

const subscriptionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((s) => s.trim()),
  duration: z.number().int().min(1).max(3650),
  price: z.number().min(0).max(1_000_000),
});

const assignSchema = z.object({
  userId: z.string().min(1).max(64),
  subscriptionId: z.number().int().min(1).max(2_147_483_647),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح (YYYY-MM-DD)"),
  paymentAmount: z.number().min(0).max(1_000_000).optional(),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
});

router.get("/subscriptions", authenticate, async (_req, res) => {
  try {
    const subs = await db.select().from(subscriptionsTable).orderBy(subscriptionsTable.name);
    res.json(subs);
  } catch (err) {
    logger.error({ err }, "GET /subscriptions failed");
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
    const [sub] = await db
      .insert(subscriptionsTable)
      .values({
        name: body.data.name,
        duration: body.data.duration,
        price: String(body.data.price),
      })
      .returning();
    res.status(201).json(sub);
  } catch (err) {
    logger.error({ err }, "POST /subscriptions failed");
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
    const [sub] = await db
      .update(subscriptionsTable)
      .set({
        name: body.data.name,
        duration: body.data.duration,
        price: String(body.data.price),
      })
      .where(eq(subscriptionsTable.id, id))
      .returning();
    if (!sub) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(sub);
  } catch (err) {
    logger.error({ err }, "PUT /subscriptions failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/subscriptions/:subscriptionId", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.subscriptionId, res, "معرّف الاشتراك");
  if (!id) return;

  try {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, id));
    res.json({ success: true, message: "تم حذف الاشتراك" });
  } catch (err) {
    logger.error({ err, id }, "DELETE /subscriptions failed");
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
    const [plan] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);
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

    const [ms] = await db
      .insert(memberSubscriptionsTable)
      .values({
        userId,
        subscriptionId,
        startDate,
        endDate,
        status: "active",
      })
      .returning();

    if (paymentAmount && paymentAmount > 0) {
      await db.insert(paymentsTable).values({
        userId,
        amount: String(paymentAmount),
        date: startDate,
        method: paymentMethod ?? "cash",
      });
    }

    res.status(201).json({ ...ms, subscription: plan });
  } catch (err) {
    logger.error({ err }, "POST /member-subscriptions failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تعيين الاشتراك" });
  }
});

router.get("/member-subscriptions/:userId/current", authenticate, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
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
  } catch (err) {
    logger.error({ err }, "GET /member-subscriptions/current failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الاشتراك" });
  }
});

// ─── Freeze / unfreeze ────────────────────────────────────────────────────────
//
// Freezing a subscription pauses the days-remaining clock. We don't subtract
// time from `endDate` at freeze-time; instead, we record `frozenAt` and shift
// `endDate` forward at unfreeze-time by exactly the elapsed days. This keeps
// the operation reversible (admin can flip the freeze on/off without "losing"
// time) and means that the member's expiry date drifts only when they're
// actively using the gym.
//
// `totalFrozenDays` is purely informational — surfaced in the UI to discourage
// abuse and inform retention conversations.

const idsSchema = z.object({
  // Cap at 500 so an admin can't accidentally hit 100k rows in one click and
  // lock the table. The Members UI paginates at 50/100, so 500 is generous.
  ids: z.array(z.number().int().min(1).max(2_147_483_647)).min(1).max(500),
});

router.patch("/member-subscriptions/:id/freeze", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف الاشتراك");
  if (!id) return;
  try {
    const [existing] = await db
      .select()
      .from(memberSubscriptionsTable)
      .where(eq(memberSubscriptionsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found", message: "الاشتراك غير موجود" });
      return;
    }
    if (existing.status === "frozen" || existing.frozenAt) {
      res.status(409).json({ error: "Conflict", message: "الاشتراك مجمد بالفعل" });
      return;
    }
    if (existing.status === "expired") {
      res.status(400).json({ error: "Validation error", message: "لا يمكن تجميد اشتراك منتهي" });
      return;
    }
    const [updated] = await db
      .update(memberSubscriptionsTable)
      .set({ status: "frozen", frozenAt: new Date() })
      .where(eq(memberSubscriptionsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, "PATCH /member-subscriptions/:id/freeze failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التجميد" });
  }
});

router.patch("/member-subscriptions/:id/unfreeze", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف الاشتراك");
  if (!id) return;
  try {
    const [existing] = await db
      .select()
      .from(memberSubscriptionsTable)
      .where(eq(memberSubscriptionsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found", message: "الاشتراك غير موجود" });
      return;
    }
    if (!existing.frozenAt || existing.status !== "frozen") {
      res.status(409).json({ error: "Conflict", message: "الاشتراك ليس مجمدًا" });
      return;
    }
    const elapsedMs = Date.now() - new Date(existing.frozenAt).getTime();
    // Round up so any partial day counts as a full freeze day — admins
    // operating at day-granularity expect "frozen for 5h" → 1 day extension.
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / 86_400_000));
    const newEnd = new Date(existing.endDate);
    newEnd.setUTCDate(newEnd.getUTCDate() + elapsedDays);
    const newEndStr = newEnd.toISOString().split("T")[0];

    const [updated] = await db
      .update(memberSubscriptionsTable)
      .set({
        status: "active",
        frozenAt: null,
        endDate: newEndStr,
        totalFrozenDays: existing.totalFrozenDays + elapsedDays,
      })
      .where(eq(memberSubscriptionsTable.id, id))
      .returning();
    res.json({ ...updated, addedDays: elapsedDays });
  } catch (err) {
    logger.error({ err, id }, "PATCH /member-subscriptions/:id/unfreeze failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إلغاء التجميد" });
  }
});

// ─── Bulk operations ──────────────────────────────────────────────────────────
//
// All bulk routes accept a list of *member subscription IDs* (not user IDs).
// The Members UI knows the current subscription per member and passes that
// row's id, so we don't have to reload anything server-side and admins can
// target a specific subscription if a member has history. Non-existent IDs
// are silently dropped — no all-or-nothing semantics, since admins generally
// want partial completion when one member is in a weird state.

const bulkExtendSchema = idsSchema.extend({
  // Capping the per-call extension at one year prevents the "I'll add 100
  // years" footgun and keeps the UI's "+30 / +60" buttons safely covered.
  days: z.number().int().min(1).max(365),
});

router.post("/member-subscriptions/bulk-extend", authenticate, requireAdmin, async (req, res) => {
  const body = bulkExtendSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const { ids, days } = body.data;
  try {
    const updated = await db
      .update(memberSubscriptionsTable)
      // Use SQL date arithmetic so we're not pulling rows over the wire just
      // to mutate one column. Postgres `date + integer` returns a date.
      .set({ endDate: sql`(${memberSubscriptionsTable.endDate} + ${days})` })
      .where(inArray(memberSubscriptionsTable.id, ids))
      .returning({ id: memberSubscriptionsTable.id });
    res.json({ updatedCount: updated.length, days });
  } catch (err) {
    logger.error({ err }, "POST /member-subscriptions/bulk-extend failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التمديد الجماعي" });
  }
});

router.post("/member-subscriptions/bulk-freeze", authenticate, requireAdmin, async (req, res) => {
  const body = idsSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const updated = await db
      .update(memberSubscriptionsTable)
      .set({ status: "frozen", frozenAt: new Date() })
      .where(
        sql`${memberSubscriptionsTable.id} IN ${body.data.ids}
            AND ${memberSubscriptionsTable.status} = 'active'
            AND ${memberSubscriptionsTable.frozenAt} IS NULL`,
      )
      .returning({ id: memberSubscriptionsTable.id });
    res.json({ frozenCount: updated.length });
  } catch (err) {
    logger.error({ err }, "POST /member-subscriptions/bulk-freeze failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التجميد الجماعي" });
  }
});

router.post("/member-subscriptions/bulk-unfreeze", authenticate, requireAdmin, async (req, res) => {
  const body = idsSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    // Bulk unfreeze is per-row arithmetic (each sub may have a different
    // `frozenAt`), so we loop client-side. With max 500 ids this is fast
    // enough not to need a single-statement CTE.
    const rows = await db
      .select()
      .from(memberSubscriptionsTable)
      .where(inArray(memberSubscriptionsTable.id, body.data.ids));
    let unfrozen = 0;
    const now = Date.now();
    for (const row of rows) {
      if (!row.frozenAt || row.status !== "frozen") continue;
      const elapsedDays = Math.max(1, Math.ceil((now - new Date(row.frozenAt).getTime()) / 86_400_000));
      const newEnd = new Date(row.endDate);
      newEnd.setUTCDate(newEnd.getUTCDate() + elapsedDays);
      await db
        .update(memberSubscriptionsTable)
        .set({
          status: "active",
          frozenAt: null,
          endDate: newEnd.toISOString().split("T")[0],
          totalFrozenDays: row.totalFrozenDays + elapsedDays,
        })
        .where(eq(memberSubscriptionsTable.id, row.id));
      unfrozen++;
    }
    res.json({ unfrozenCount: unfrozen });
  } catch (err) {
    logger.error({ err }, "POST /member-subscriptions/bulk-unfreeze failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إلغاء التجميد الجماعي" });
  }
});

// ─── CSV export of selected members ───────────────────────────────────────────
//
// Streams a CSV of the listed users with subscription metadata. Returns
// text/csv so browsers download it directly. Implementation is a manual
// builder rather than papaparse to avoid pulling another dep and to keep
// the BOM control: Excel needs a UTF-8 BOM to render Arabic correctly.

const exportCsvSchema = z.object({
  userIds: z.array(z.string().min(1).max(64)).min(1).max(2000),
});

router.post("/member-subscriptions/export-csv", authenticate, requireAdmin, async (req, res) => {
  const body = exportCsvSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        membershipNumber: usersTable.membershipNumber,
        category: usersTable.category,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        frozenAt: memberSubscriptionsTable.frozenAt,
        totalFrozenDays: memberSubscriptionsTable.totalFrozenDays,
        subName: subscriptionsTable.name,
        subPrice: subscriptionsTable.price,
      })
      .from(usersTable)
      .leftJoin(memberSubscriptionsTable, eq(memberSubscriptionsTable.userId, usersTable.id))
      .leftJoin(subscriptionsTable, eq(subscriptionsTable.id, memberSubscriptionsTable.subscriptionId))
      .where(inArray(usersTable.id, body.data.userIds))
      .orderBy(usersTable.name);

    // Keep latest subscription per user (rows ordered by name; we'll dedupe
    // by id keeping the most recent endDate).
    const seen = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const prev = seen.get(r.id);
      if (!prev) {
        seen.set(r.id, r);
        continue;
      }
      if ((r.endDate ?? "") > (prev.endDate ?? "")) seen.set(r.id, r);
    }

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const header = [
      "ID",
      "الاسم",
      "الهاتف",
      "كود العضوية",
      "الفئة",
      "الباقة",
      "سعر الباقة",
      "بداية الاشتراك",
      "نهاية الاشتراك",
      "الحالة",
      "تاريخ التجميد",
      "إجمالي أيام التجميد",
    ]
      .map(escape)
      .join(",");
    const lines = [header];
    for (const r of seen.values()) {
      lines.push(
        [
          r.id,
          r.name,
          r.phone,
          r.membershipNumber ?? "",
          r.category ?? "",
          r.subName ?? "",
          r.subPrice ?? "",
          r.startDate ?? "",
          r.endDate ?? "",
          r.status ?? "",
          r.frozenAt ? new Date(r.frozenAt).toISOString().split("T")[0] : "",
          r.totalFrozenDays ?? 0,
        ]
          .map(escape)
          .join(","),
      );
    }
    // BOM (\uFEFF) tells Excel "this is UTF-8" so Arabic renders correctly.
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="members-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error({ err }, "POST /member-subscriptions/export-csv failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تصدير CSV" });
  }
});

router.get("/member-subscriptions/:userId/history", authenticate, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
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
  } catch (err) {
    logger.error({ err }, "GET /member-subscriptions/history failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجل" });
  }
});

export default router;
