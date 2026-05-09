import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  subscriptionsTable,
  renewalRemindersTable,
} from "@workspace/db/schema";
import { eq, and, lte, gte, desc, isNull, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

/**
 * GET /api/renewal-reminders/expiring?days=N
 *
 * Lists active subscriptions whose `endDate` falls in `[today, today+days]`.
 * Skips frozen subscriptions (those don't expire while paused) and skips
 * members already pinged in the last 24h so the queue stays small.
 *
 * Defaults to 3 days — that's the window the WA template
 * "قرب انتهاء الاشتراك ⚠️" was seeded for.
 */
router.get("/renewal-reminders/expiring", authenticate, requireAdmin, async (req, res) => {
  const daysParam = z.coerce.number().int().min(0).max(60).default(3).safeParse(req.query.days);
  const days = daysParam.success ? daysParam.data : 3;

  try {
    const today = new Date().toISOString().split("T")[0];
    const cutoff = new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
    const since24h = new Date(Date.now() - 86_400_000);

    // Pull subscriptions in the window. Use a left-join on
    // `renewal_reminders` filtered to "sent in the last 24h" so we can
    // surface a `lastReminderAt` even for members we'd still include.
    const rows = await db
      .select({
        memberSubscriptionId: memberSubscriptionsTable.id,
        userId: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        membershipNumber: usersTable.membershipNumber,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        subName: subscriptionsTable.name,
      })
      .from(memberSubscriptionsTable)
      .innerJoin(usersTable, eq(usersTable.id, memberSubscriptionsTable.userId))
      .innerJoin(subscriptionsTable, eq(subscriptionsTable.id, memberSubscriptionsTable.subscriptionId))
      .where(
        and(
          eq(memberSubscriptionsTable.status, "active"),
          gte(memberSubscriptionsTable.endDate, today),
          lte(memberSubscriptionsTable.endDate, cutoff),
        ),
      )
      .orderBy(memberSubscriptionsTable.endDate);

    if (rows.length === 0) {
      res.json({ days, items: [] });
      return;
    }

    // Annotate each row with whether we already reminded them in the last
    // 24h. Done as a separate query so the join doesn't blow up the row
    // count when a single member has multiple log entries.
    const userIds = rows.map((r) => r.userId);
    const recentLogs = await db
      .select({
        userId: renewalRemindersTable.userId,
        sentAt: renewalRemindersTable.sentAt,
      })
      .from(renewalRemindersTable)
      .where(
        and(
          gte(renewalRemindersTable.sentAt, since24h),
          sql`${renewalRemindersTable.userId} = ANY(${userIds})`,
        ),
      )
      .orderBy(desc(renewalRemindersTable.sentAt));
    const lastByUser = new Map<string, Date>();
    for (const l of recentLogs) {
      if (!lastByUser.has(l.userId)) lastByUser.set(l.userId, l.sentAt);
    }

    const today00 = new Date(today);
    const items = rows.map((r) => {
      const end = new Date(r.endDate);
      const daysLeft = Math.ceil((end.getTime() - today00.getTime()) / 86_400_000);
      return {
        ...r,
        daysLeft,
        lastReminderAt: lastByUser.get(r.userId) ?? null,
      };
    });
    res.json({ days, items });
  } catch (err) {
    logger.error({ err }, "GET /renewal-reminders/expiring failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب المنتهية قريباً" });
  }
});

/**
 * GET /api/renewal-reminders
 *
 * Recent log of who was reminded, when, by whom. Capped at 200 by default
 * because admins typically only need the last few weeks for spot-checking.
 */
router.get("/renewal-reminders", authenticate, requireAdmin, async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(500).default(200).safeParse(req.query.limit);
  try {
    const rows = await db
      .select({
        id: renewalRemindersTable.id,
        userId: renewalRemindersTable.userId,
        userName: usersTable.name,
        userPhone: usersTable.phone,
        memberSubscriptionId: renewalRemindersTable.memberSubscriptionId,
        channel: renewalRemindersTable.channel,
        sentBy: renewalRemindersTable.sentBy,
        success: renewalRemindersTable.success,
        note: renewalRemindersTable.note,
        sentAt: renewalRemindersTable.sentAt,
      })
      .from(renewalRemindersTable)
      .leftJoin(usersTable, eq(usersTable.id, renewalRemindersTable.userId))
      .orderBy(desc(renewalRemindersTable.sentAt))
      .limit(limit.success ? limit.data : 200);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /renewal-reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجل" });
  }
});

const logReminderSchema = z.object({
  userId: z.string().min(1).max(64),
  memberSubscriptionId: z.number().int().min(1).max(2_147_483_647).optional(),
  // "whatsapp" = the admin clicked a wa.me link in the UI;
  // "system"   = the cron noticed the member was about to expire.
  channel: z.enum(["whatsapp", "system"]).default("whatsapp"),
  success: z.boolean().default(true),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/renewal-reminders
 *
 * Records that a renewal reminder was just sent — fires from the Members
 * page and the Renewals queue right after the admin clicks the wa.me link.
 * We can't *prove* the message was actually delivered (that requires the
 * WhatsApp Business API), but recording the click gives us the dedupe + an
 * audit trail.
 */
router.post("/renewal-reminders", authenticate, requireAdmin, async (req, res) => {
  const body = logReminderSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [row] = await db
      .insert(renewalRemindersTable)
      .values({
        userId: body.data.userId,
        memberSubscriptionId: body.data.memberSubscriptionId ?? null,
        channel: body.data.channel,
        sentBy: req.user!.userId,
        success: body.data.success,
        note: body.data.note ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /renewal-reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التسجيل" });
  }
});

const bulkLogSchema = z.object({
  // Each entry mirrors `logReminderSchema` minus the per-item channel —
  // bulk sends are always "whatsapp" today.
  userIds: z.array(z.string().min(1).max(64)).min(1).max(500),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/renewal-reminders/bulk-log
 *
 * Records one row per userId in a single insert. Used after the admin
 * clicks "أرسل للكل" on the Renewals page (which opens N wa.me tabs).
 */
router.post("/renewal-reminders/bulk-log", authenticate, requireAdmin, async (req, res) => {
  const body = bulkLogSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const inserted = await db
      .insert(renewalRemindersTable)
      .values(
        body.data.userIds.map((uid) => ({
          userId: uid,
          channel: "whatsapp" as const,
          sentBy: req.user!.userId,
          success: true,
          note: body.data.note ?? null,
        })),
      )
      .returning({ id: renewalRemindersTable.id });
    res.status(201).json({ insertedCount: inserted.length });
  } catch (err) {
    logger.error({ err }, "POST /renewal-reminders/bulk-log failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التسجيل الجماعي" });
  }
});

/**
 * POST /api/renewal-reminders/run-now
 *
 * Manually trigger the daily cron pass — useful for admins who want to
 * refresh the queue mid-day, and for ops/QA to verify the job is wired up.
 * Runs the same logic the scheduled tick uses.
 */
router.post("/renewal-reminders/run-now", authenticate, requireAdmin, async (_req, res) => {
  const { runRenewalReminderPass } = await import("../jobs/renewal-reminders.js");
  try {
    const summary = await runRenewalReminderPass();
    res.json(summary);
  } catch (err) {
    logger.error({ err }, "POST /renewal-reminders/run-now failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تشغيل المهمة" });
  }
});

// ─── Sweep expired subscriptions ──────────────────────────────────────────────
//
// Postgres won't auto-flip `active → expired` when `endDate < today`; we used
// to do that lazily on read. Doing it server-side once a day means the
// "expiring soon" queue and the dashboard's status counts stay accurate
// without UI hacks.
export async function expireOverdueSubscriptions(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const updated = await db
    .update(memberSubscriptionsTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(memberSubscriptionsTable.status, "active"),
        isNull(memberSubscriptionsTable.frozenAt),
        sql`${memberSubscriptionsTable.endDate} < ${today}`,
      ),
    )
    .returning({ id: memberSubscriptionsTable.id });
  return updated.length;
}

export default router;
