import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  absenceRemindersTable,
  waTemplatesTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { withAdvisoryLock, ABSENCE_REMINDER_LOCK_KEY } from "../lib/advisory-lock.js";

/**
 * Returns "now" rounded to the start of the next hour. Used to schedule the
 * first cron tick — we want a predictable cadence (every hour on the hour)
 * without firing immediately on every boot.
 */
function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

const ABSENCE_DAYS = 3;
const RUN_INTERVAL_MS = 60 * 60 * 1000; // hourly tick
const DEDUPE_WINDOW_HOURS = 23; // 23 not 24, to avoid drift if a tick fires a few seconds early

export interface AbsencePassSummary {
  candidates: number; // members absent ≥ ABSENCE_DAYS
  logged: number;     // new system rows inserted
  skipped: number;    // candidates already pinged/flagged in the last 23h
  message: string;    // the WA template body for the admin UI to preview
}

/**
 * One pass of the absence-reminder job:
 *  1. Find active subscriptions where the user's last check-in is older
 *     than ABSENCE_DAYS days (or who never checked in and joined ≥3d ago).
 *  2. Skip members already flagged/reminded in the last 23h.
 *  3. For each remaining member, insert an `absence_reminders` row with
 *     `channel = 'system'` so the admin queue surfaces them.
 *
 * Like `renewal-reminders`, this job is side-effect-light — it does NOT
 * actually send a WhatsApp message. The admin clicks the wa.me link from
 * the Absent Members page; the cron just makes sure no one is missed.
 */
export async function runAbsenceReminderPass(): Promise<AbsencePassSummary> {
  const todayIso = new Date().toISOString().split("T")[0];
  const cutoff = new Date(Date.now() - ABSENCE_DAYS * 86_400_000);
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await db
    .select({
      userId: usersTable.id,
      startDate: memberSubscriptionsTable.startDate,
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
        sql`${memberSubscriptionsTable.endDate} >= ${todayIso}`,
      ),
    );

  const candidates = rows.filter((r) => {
    if (!r.lastCheckinAt) {
      return new Date(r.startDate).getTime() <= cutoff.getTime();
    }
    return new Date(r.lastCheckinAt).getTime() < cutoff.getTime();
  });

  if (candidates.length === 0) {
    return { candidates: 0, logged: 0, skipped: 0, message: await pickMessage() };
  }

  const userIds = candidates.map((c) => c.userId);
  const recent = await db
    .select({ userId: absenceRemindersTable.userId })
    .from(absenceRemindersTable)
    .where(
      and(
        sql`${absenceRemindersTable.sentAt} >= ${dedupeSince}`,
        sql`${absenceRemindersTable.userId} = ANY(${userIds})`,
      ),
    );
  const recentSet = new Set(recent.map((r) => r.userId));

  const toInsert = candidates.filter((c) => !recentSet.has(c.userId));
  if (toInsert.length === 0) {
    return {
      candidates: candidates.length,
      logged: 0,
      skipped: candidates.length,
      message: await pickMessage(),
    };
  }

  await db.insert(absenceRemindersTable).values(
    toInsert.map((c) => ({
      userId: c.userId,
      channel: "system" as const,
      sentBy: null,
      // success=false because the admin still has to click the wa.me link —
      // this row only records "we surfaced this member". The follow-up
      // POST /absence-reminders from the UI logs success=true.
      success: false,
      note: `auto-detected absent ≥${ABSENCE_DAYS} days`,
    })),
  );

  return {
    candidates: candidates.length,
    logged: toInsert.length,
    skipped: candidates.length - toInsert.length,
    message: await pickMessage(),
  };
}

async function pickMessage(): Promise<string> {
  // Surface the "absence" template so the UI can preview the message
  // admins are about to send. Match the seeded Arabic name or any template
  // whose name/body mentions absence so a future admin can rename it.
  try {
    const [row] = await db
      .select({ body: waTemplatesTable.body })
      .from(waTemplatesTable)
      .where(
        and(
          eq(waTemplatesTable.enabled, true),
          sql`(
            ${waTemplatesTable.name} ILIKE '%غياب%' OR
            ${waTemplatesTable.name} ILIKE '%absent%' OR
            ${waTemplatesTable.body}  ILIKE '%days_absent%'
          )`,
        ),
      )
      .orderBy(desc(waTemplatesTable.sortOrder))
      .limit(1);
    return row?.body ?? "";
  } catch {
    return "";
  }
}

let timer: NodeJS.Timeout | null = null;

/**
 * Wire up the recurring tick. Called once at server boot. Designed to be a
 * no-op when called twice (so hot-reloads in dev don't multiply timers).
 */
export function startAbsenceReminderJob(): void {
  if (timer) return;
  if (process.env.ABSENCE_REMINDERS_DISABLED === "1") {
    logger.info("Absence reminder job disabled via ABSENCE_REMINDERS_DISABLED");
    return;
  }

  const tick = async (): Promise<void> => {
    // Wrap the pass in a Postgres advisory lock so multi-instance deploys
    // (Render, k8s) don't double-fire the reminder logic. If another replica
    // is currently running it, we simply skip this tick.
    const outcome = await withAdvisoryLock(ABSENCE_REMINDER_LOCK_KEY, async () => {
      try {
        const summary = await runAbsenceReminderPass();
        if (summary.logged > 0) {
          logger.info({ summary }, "Absence reminder pass completed");
        }
      } catch (err) {
        logger.error({ err }, "Absence reminder pass failed");
      }
    });
    if (!outcome.acquired) {
      logger.debug("Absence reminder tick skipped — another instance holds the lock");
    }
  };

  setTimeout(() => {
    void tick();
    timer = setInterval(tick, RUN_INTERVAL_MS);
  }, msUntilNextHour());
  logger.info({ delayMs: msUntilNextHour(), intervalMs: RUN_INTERVAL_MS }, "Absence reminder job scheduled");
}

export function stopAbsenceReminderJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
