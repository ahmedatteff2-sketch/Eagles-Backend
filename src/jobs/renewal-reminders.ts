import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  subscriptionsTable,
  renewalRemindersTable,
  waTemplatesTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { withAdvisoryLock, RENEWAL_REMINDER_LOCK_KEY } from "../lib/advisory-lock.js";

/**
 * Returns "now" rounded to the start of the next hour. Used to schedule the
 * first cron tick — we don't want to fire immediately on boot since the
 * server boots dozens of times a week during deploys, but we *do* want a
 * predictable cadence (every hour on the hour).
 */
function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

const REMINDER_WINDOW_DAYS = 3;
const RUN_INTERVAL_MS = 60 * 60 * 1000; // hourly tick — see below for why
const DEDUPE_WINDOW_HOURS = 23; // 23 not 24, to avoid drift if a tick fires a few seconds early

export interface RenewalPassSummary {
  candidates: number; // members in the upcoming-expiry window
  logged: number; // rows newly inserted into renewal_reminders
  skipped: number; // candidates skipped because they were already reminded
  message: string; // the WA template body, with no per-member substitution
}

/**
 * One pass of the renewal-reminder job:
 *  1. Find active, non-frozen subscriptions ending in `[today, today+3]`
 *  2. Skip members already reminded in the last `DEDUPE_WINDOW_HOURS` hours
 *  3. For each remaining member, insert a `renewal_reminders` row with
 *     `channel = 'system'` so the admin queue can show "we should ping
 *     this person".
 *
 * The job is intentionally side-effect-light — it does NOT actually send
 * a WhatsApp message (we don't have a Business API integration). The admin
 * clicks the wa.me link from the Renewals page; the cron's job is just to
 * make sure no eligible member is missed.
 */
export async function runRenewalReminderPass(): Promise<RenewalPassSummary> {
  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date(Date.now() + REMINDER_WINDOW_DAYS * 86_400_000).toISOString().split("T")[0];
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await db
    .select({
      userId: usersTable.id,
      memberSubscriptionId: memberSubscriptionsTable.id,
    })
    .from(memberSubscriptionsTable)
    .innerJoin(usersTable, eq(usersTable.id, memberSubscriptionsTable.userId))
    .where(
      and(
        eq(memberSubscriptionsTable.status, "active"),
        gte(memberSubscriptionsTable.endDate, today),
        lte(memberSubscriptionsTable.endDate, cutoff),
      ),
    );

  if (candidates.length === 0) {
    return { candidates: 0, logged: 0, skipped: 0, message: await pickMessage() };
  }

  const userIds = candidates.map((c) => c.userId);
  const recent = await db
    .select({ userId: renewalRemindersTable.userId })
    .from(renewalRemindersTable)
    .where(
      and(
        gte(renewalRemindersTable.sentAt, dedupeSince),
        sql`${renewalRemindersTable.userId} = ANY(${userIds})`,
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

  await db.insert(renewalRemindersTable).values(
    toInsert.map((c) => ({
      userId: c.userId,
      memberSubscriptionId: c.memberSubscriptionId,
      channel: "system" as const,
      sentBy: null,
      // Marked as success=false because the admin still has to click the
      // WhatsApp link — this row only records "we surfaced this member".
      // The follow-up POST /renewal-reminders from the UI marks success=true.
      success: false,
      note: "auto-detected expiring within 3 days",
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
  // Surface the "renewal" template so the admin UI can show admins the
  // message they would send. Match either the seeded Arabic name or anything
  // containing "renew" / "تجديد" / "ينتهي" so a future admin can rename it
  // without breaking the job.
  try {
    const [row] = await db
      .select({ body: waTemplatesTable.body })
      .from(waTemplatesTable)
      .where(
        and(
          eq(waTemplatesTable.enabled, true),
          sql`(
            ${waTemplatesTable.name} ILIKE '%قرب انتهاء%' OR
            ${waTemplatesTable.name} ILIKE '%تجديد%' OR
            ${waTemplatesTable.name} ILIKE '%renew%' OR
            ${waTemplatesTable.body} ILIKE '%end_date%'
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
 * Wire up the recurring tick. Called once at server boot. Designed to be
 * a no-op when called twice (so hot-reloads in dev don't multiply timers).
 */
export function startRenewalReminderJob(): void {
  if (timer) return;
  if (process.env.RENEWAL_REMINDERS_DISABLED === "1") {
    logger.info("Renewal reminder job disabled via RENEWAL_REMINDERS_DISABLED");
    return;
  }

  const tick = async (): Promise<void> => {
    // Wrap the pass in a Postgres advisory lock so multi-instance deploys
    // (Render, k8s) don't double-fire the reminder logic. If another replica
    // is currently running it, we simply skip this tick.
    const outcome = await withAdvisoryLock(RENEWAL_REMINDER_LOCK_KEY, async () => {
      try {
        const summary = await runRenewalReminderPass();
        if (summary.logged > 0) {
          logger.info({ summary }, "Renewal reminder pass completed");
        }
      } catch (err) {
        logger.error({ err }, "Renewal reminder pass failed");
      }
    });
    if (!outcome.acquired) {
      logger.debug("Renewal reminder tick skipped — another instance holds the lock");
    }
  };

  // First tick on the next hour boundary so timestamps are tidy.
  setTimeout(() => {
    void tick();
    timer = setInterval(tick, RUN_INTERVAL_MS);
  }, msUntilNextHour());
  logger.info({ delayMs: msUntilNextHour(), intervalMs: RUN_INTERVAL_MS }, "Renewal reminder job scheduled");
}

export function stopRenewalReminderJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
