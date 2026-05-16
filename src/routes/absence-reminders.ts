import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  absenceRemindersTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

/**
 * GET /api/absence-reminders/absent?days=N
 *
 * Lists members with an *active* (non-frozen) subscription whose most-recent
 * CheckIn timestamp is older than `N` days — or who have never checked in at
 * all and whose subscription started more than `N` days ago.
 *
 * Defaults to 3 days, matching the user's request ("3 consecutive days with
 * no check-in"). Also annotates each member with the last `whatsapp`-channel
 * reminder so the UI can show a "تم التواصل قبل ساعة" badge.
 */
router.get("/absence-reminders/absent", authenticate, requireAdmin, async (req, res) => {
  const daysParam = z.coerce.number().int().min(1).max(30).default(3).safeParse(req.query.days);
  const days = daysParam.success ? daysParam.data : 3;

  try {
    const todayIso = new Date().toISOString().split("T")[0];
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const since24h = new Date(Date.now() - 86_400_000);

    // For each active subscription, pull the user's most recent check-in.
    // Done via a LATERAL-style sub-select so we get exactly one row per
    // member regardless of how many check-ins they've ever had.
    const rows = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        membershipNumber: usersTable.membershipNumber,
        memberSubscriptionId: memberSubscriptionsTable.id,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        lastCheckinAt: sql<Date | null>`(
          SELECT MAX(c."timestamp")
          FROM "CheckIn" c
          WHERE c."userId" = ${usersTable.id}
        )`.as("last_checkin_at"),
      })
      .from(memberSubscriptionsTable)
      .innerJoin(usersTable, eq(usersTable.id, memberSubscriptionsTable.userId))
      .where(
        and(
          eq(memberSubscriptionsTable.status, "active"),
          // Still in window — don't surface members whose membership already
          // ended yesterday; that's the Renewals queue's job.
          sql`${memberSubscriptionsTable.endDate} >= ${todayIso}`,
        ),
      );

    // Filter to members who either (a) never checked in AND joined ≥ N days
    // ago, or (b) last check-in was before the cutoff. Done in JS rather
    // than SQL because the sub-select alias isn't usable in `WHERE`.
    const absent = rows.filter((r) => {
      if (!r.lastCheckinAt) {
        const started = new Date(r.startDate);
        return started.getTime() <= cutoff.getTime();
      }
      return new Date(r.lastCheckinAt).getTime() < cutoff.getTime();
    });

    if (absent.length === 0) {
      res.json({ days, items: [] });
      return;
    }

    // Annotate with last reminder in the last 24h so the UI can dedupe.
    const userIds = absent.map((r) => r.userId);
    const recentLogs = await db
      .select({
        userId: absenceRemindersTable.userId,
        sentAt: absenceRemindersTable.sentAt,
      })
      .from(absenceRemindersTable)
      .where(
        and(
          sql`${absenceRemindersTable.sentAt} >= ${since24h}`,
          sql`${absenceRemindersTable.userId} = ANY(${userIds})`,
          eq(absenceRemindersTable.channel, "whatsapp"),
        ),
      )
      .orderBy(desc(absenceRemindersTable.sentAt));
    const lastByUser = new Map<string, Date>();
    for (const l of recentLogs) {
      if (!lastByUser.has(l.userId)) lastByUser.set(l.userId, l.sentAt);
    }

    const now = Date.now();
    const items = absent.map((r) => {
      const lastCheckin = r.lastCheckinAt ? new Date(r.lastCheckinAt) : null;
      const reference = lastCheckin ?? new Date(r.startDate);
      const daysAbsent = Math.floor((now - reference.getTime()) / 86_400_000);
      return {
        userId: r.userId,
        name: r.name,
        phone: r.phone,
        membershipNumber: r.membershipNumber,
        memberSubscriptionId: r.memberSubscriptionId,
        startDate: r.startDate,
        endDate: r.endDate,
        lastCheckinAt: lastCheckin ? lastCheckin.toISOString() : null,
        daysAbsent,
        lastReminderAt: lastByUser.get(r.userId)?.toISOString() ?? null,
      };
    });

    // Sort: longest-absent first, then by name for stable ordering.
    items.sort((a, b) => b.daysAbsent - a.daysAbsent || a.name.localeCompare(b.name, "ar"));

    res.json({ days, items });
  } catch (err) {
    logger.error({ err }, "GET /absence-reminders/absent failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الغائبين" });
  }
});

/**
 * GET /api/absence-reminders
 *
 * Recent log of who was reminded, when, by whom. Capped at 200 by default
 * because admins typically only need the last few weeks.
 */
router.get("/absence-reminders", authenticate, requireAdmin, async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(500).default(200).safeParse(req.query.limit);
  try {
    const rows = await db
      .select({
        id: absenceRemindersTable.id,
        userId: absenceRemindersTable.userId,
        userName: usersTable.name,
        userPhone: usersTable.phone,
        channel: absenceRemindersTable.channel,
        sentBy: absenceRemindersTable.sentBy,
        success: absenceRemindersTable.success,
        note: absenceRemindersTable.note,
        sentAt: absenceRemindersTable.sentAt,
      })
      .from(absenceRemindersTable)
      .leftJoin(usersTable, eq(usersTable.id, absenceRemindersTable.userId))
      .orderBy(desc(absenceRemindersTable.sentAt))
      .limit(limit.success ? limit.data : 200);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /absence-reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجل" });
  }
});

const logReminderSchema = z.object({
  userId: z.string().min(1).max(64),
  // "whatsapp" = the admin clicked a wa.me link in the UI;
  // "system"   = the cron noticed the member was absent.
  channel: z.enum(["whatsapp", "system"]).default("whatsapp"),
  success: z.boolean().default(true),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/absence-reminders
 *
 * Records that an absence reminder was just sent. We can't *prove* the
 * message was actually delivered (that requires the WhatsApp Business API),
 * but recording the click gives us the dedupe + an audit trail.
 */
router.post("/absence-reminders", authenticate, requireAdmin, async (req, res) => {
  const body = logReminderSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [row] = await db
      .insert(absenceRemindersTable)
      .values({
        userId: body.data.userId,
        channel: body.data.channel,
        sentBy: req.user!.userId,
        success: body.data.success,
        note: body.data.note ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /absence-reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التسجيل" });
  }
});

const bulkLogSchema = z.object({
  userIds: z.array(z.string().min(1).max(64)).min(1).max(500),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/absence-reminders/bulk-log
 *
 * Records one row per userId in a single insert. Used after the admin
 * clicks "أرسل للكل" on the Absent Members page.
 */
router.post("/absence-reminders/bulk-log", authenticate, requireAdmin, async (req, res) => {
  const body = bulkLogSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const inserted = await db
      .insert(absenceRemindersTable)
      .values(
        body.data.userIds.map((uid) => ({
          userId: uid,
          channel: "whatsapp" as const,
          sentBy: req.user!.userId,
          success: true,
          note: body.data.note ?? null,
        })),
      )
      .returning({ id: absenceRemindersTable.id });
    res.status(201).json({ insertedCount: inserted.length });
  } catch (err) {
    logger.error({ err }, "POST /absence-reminders/bulk-log failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التسجيل الجماعي" });
  }
});

/**
 * POST /api/absence-reminders/run-now
 *
 * Manually trigger the hourly cron pass — useful for admins who want to
 * refresh the queue, and for ops/QA to verify the job is wired up.
 */
router.post("/absence-reminders/run-now", authenticate, requireAdmin, async (_req, res) => {
  const { runAbsenceReminderPass } = await import("../jobs/absence-reminders.js");
  try {
    const summary = await runAbsenceReminderPass();
    res.json(summary);
  } catch (err) {
    logger.error({ err }, "POST /absence-reminders/run-now failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تشغيل المهمة" });
  }
});

export default router;
