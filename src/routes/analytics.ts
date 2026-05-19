import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  paymentsTable,
  checkinsTable,
  exerciseLogsTable,
  bodyStatsTable,
  expensesTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, count, sum, gte, lte, desc, and, sql, inArray } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseUserId } from "../lib/params.js";
import { logger } from "../lib/logger.js";

const router = Router();

let lastRenewalCheck = 0;
async function checkExpiringSubscriptions() {
  const now = Date.now();
  if (now - lastRenewalCheck < 86400000) return; // once per day
  lastRenewalCheck = now;
  try {
    const today = new Date();
    const in3days = new Date(today.getTime() + 3 * 86400000).toISOString().split("T")[0];
    const in1day = new Date(today.getTime() + 1 * 86400000).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const expiring = await db
      .select({
        userId: memberSubscriptionsTable.userId,
        endDate: memberSubscriptionsTable.endDate,
      })
      .from(memberSubscriptionsTable)
      .where(
        and(
          eq(memberSubscriptionsTable.status, "active"),
          gte(memberSubscriptionsTable.endDate, todayStr),
          lte(memberSubscriptionsTable.endDate, in3days),
        ),
      );

    for (const sub of expiring) {
      const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - today.getTime()) / 86400000);
      const title =
        daysLeft <= 0
          ? "⚠️ اشتراكك ينتهي اليوم!"
          : daysLeft === 1
            ? "⚠️ اشتراكك ينتهي غداً"
            : `⏰ اشتراكك ينتهي بعد ${daysLeft} أيام`;
      const existing = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, sub.userId),
            eq(notificationsTable.type, "subscription_expiry"),
            gte(notificationsTable.createdAt, new Date(todayStr)),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(notificationsTable).values({
          userId: sub.userId,
          title,
          body: "تواصل مع الإدارة لتجديد اشتراكك",
          type: "subscription_expiry",
        });
      }
    }
  } catch {
    /* silent */
  }
}

router.get("/analytics/dashboard", authenticate, requireAdmin, async (req, res) => {
  checkExpiringSubscriptions();
  const today = new Date().toISOString().split("T")[0]!;
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const monthStart = thisMonth.toISOString().split("T")[0]!;
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const weekEnd = nextWeek.toISOString().split("T")[0]!;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [totalMembersRow] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "member"));
  const [activeMembersRow] = await db
    .select({ count: count() })
    .from(memberSubscriptionsTable)
    .where(eq(memberSubscriptionsTable.status, "active"));
  const [totalRevenueRow] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable);
  const [monthlyRevenueRow] = await db
    .select({ total: sum(paymentsTable.amount) })
    .from(paymentsTable)
    .where(gte(paymentsTable.date, monthStart));
  const [monthlyExpensesRow] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(gte(expensesTable.date, monthStart));
  const [todayCheckinsRow] = await db
    .select({ count: count() })
    .from(checkinsTable)
    .where(and(gte(checkinsTable.timestamp, todayStart), lte(checkinsTable.timestamp, todayEnd)));
  const [expiringRow] = await db
    .select({ count: count() })
    .from(memberSubscriptionsTable)
    .where(
      and(
        eq(memberSubscriptionsTable.status, "active"),
        gte(memberSubscriptionsTable.endDate, today),
        lte(memberSubscriptionsTable.endDate, weekEnd),
      ),
    );
  const totalMembers = totalMembersRow?.count ?? 0;
  const activeMembers = activeMembersRow?.count ?? 0;

  const recentPayments = await db
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
    .orderBy(desc(paymentsTable.date))
    .limit(5);

  // Expiring subscriptions detail
  const expiringMembers = await db
    .select({
      userId: memberSubscriptionsTable.userId,
      endDate: memberSubscriptionsTable.endDate,
      userName: usersTable.name,
      userPhone: usersTable.phone,
    })
    .from(memberSubscriptionsTable)
    .innerJoin(usersTable, eq(memberSubscriptionsTable.userId, usersTable.id))
    .where(
      and(
        eq(memberSubscriptionsTable.status, "active"),
        gte(memberSubscriptionsTable.endDate, today),
        lte(memberSubscriptionsTable.endDate, weekEnd),
      ),
    )
    .orderBy(memberSubscriptionsTable.endDate);

  // Top attendees this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const topAttendeesRaw = await db
    .select({ userId: checkinsTable.userId, userName: usersTable.name, checkins: count() })
    .from(checkinsTable)
    .innerJoin(usersTable, eq(checkinsTable.userId, usersTable.id))
    .where(gte(checkinsTable.timestamp, weekStart))
    .groupBy(checkinsTable.userId, usersTable.name)
    .orderBy(desc(count()))
    .limit(5);
  const topAttendees = topAttendeesRaw.map((r) => ({ id: r.userId, name: r.userName, checkins: r.checkins }));

  // Inactive members: active subscription but no check-in in 7+ days. The
  // previous implementation issued 2 queries per active member (O(2N)) just
  // to compute "last check-in" per user — replace with a single aggregated
  // query joined to users.
  const inactiveRaw = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.phone,
      MAX(c."timestamp") AS last_checkin
    FROM "User" u
    INNER JOIN member_subscriptions ms ON ms.user_id = u.id AND ms.status = 'active'
    LEFT JOIN "CheckIn" c ON c."userId" = u.id
    GROUP BY u.id, u.name, u.phone
    HAVING MAX(c."timestamp") IS NULL
       OR MAX(c."timestamp") < NOW() - INTERVAL '7 days'
    ORDER BY last_checkin NULLS FIRST
    LIMIT 10
  `);
  const inactiveMembers = (
    inactiveRaw.rows as Array<{ id: string; name: string; phone: string; last_checkin: string | null }>
  ).map((r) => {
    const days = r.last_checkin
      ? Math.floor((Date.now() - new Date(r.last_checkin).getTime()) / 86400000)
      : 999;
    return { id: r.id, name: r.name, phone: r.phone, daysSince: Math.min(days, 999) };
  });

  res.json({
    totalMembers,
    activeMembers,
    expiredMembers: totalMembers - activeMembers,
    totalRevenue: Number(totalRevenueRow?.total ?? 0),
    monthlyRevenue: Number(monthlyRevenueRow?.total ?? 0),
    monthlyExpenses: Number(monthlyExpensesRow?.total ?? 0),
    monthlyProfit: Number(monthlyRevenueRow?.total ?? 0) - Number(monthlyExpensesRow?.total ?? 0),
    todayCheckins: todayCheckinsRow?.count ?? 0,
    expiringThisWeek: expiringRow?.count ?? 0,
    expiringMembers,
    recentPayments,
    topAttendees,
    inactiveMembers: inactiveMembers.slice(0, 10),
  });
});

router.get("/analytics/monthly-revenue", authenticate, requireAdmin, async (req, res) => {
  try {
    const revenueRows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'YYYY-MM') as month,
        SUM(amount::numeric) as revenue,
        COUNT(*) as payment_count
      FROM payments
      WHERE date >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    const expenseRows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'YYYY-MM') as month,
        SUM(amount::numeric) as expenses
      FROM expenses
      WHERE date >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    const expenseMap: Record<string, number> = {};
    for (const row of expenseRows.rows as any[]) {
      expenseMap[row.month] = Number(row.expenses ?? 0);
    }

    const MONTH_AR: Record<string, string> = {
      "01": "يناير",
      "02": "فبراير",
      "03": "مارس",
      "04": "أبريل",
      "05": "مايو",
      "06": "يونيو",
      "07": "يوليو",
      "08": "أغسطس",
      "09": "سبتمبر",
      "10": "أكتوبر",
      "11": "نوفمبر",
      "12": "ديسمبر",
    };

    const data = (revenueRows.rows as any[]).map((row) => {
      const [, month] = (row.month as string).split("-");
      return {
        month: MONTH_AR[month ?? ""] ?? row.month,
        monthKey: row.month,
        revenue: Number(row.revenue ?? 0),
        expenses: expenseMap[row.month] ?? 0,
        profit: Number(row.revenue ?? 0) - (expenseMap[row.month] ?? 0),
        paymentCount: Number(row.payment_count ?? 0),
      };
    });

    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب بيانات الإيرادات" });
  }
});

router.get("/analytics/member/:userId", authenticate, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
  if (!userId) return;
  if (req.user!.role !== "admin" && req.user!.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const bodyStats = await db
    .select()
    .from(bodyStatsTable)
    .where(eq(bodyStatsTable.userId, userId))
    .orderBy(bodyStatsTable.date);
  const weightProgress = bodyStats
    .filter((s) => s.weight != null)
    .map((s) => ({ date: s.date, value: Number(s.weight) }));
  const bodyFatProgress = bodyStats
    .filter((s) => s.bodyFat != null)
    .map((s) => ({ date: s.date, value: Number(s.bodyFat) }));

  const [attendanceRow] = await db
    .select({ count: count() })
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, userId));
  const [setsRow] = await db
    .select({ count: count() })
    .from(exerciseLogsTable)
    .where(eq(exerciseLogsTable.userId, userId));

  const exerciseLogs = await db
    .select()
    .from(exerciseLogsTable)
    .where(eq(exerciseLogsTable.userId, userId))
    .orderBy(desc(exerciseLogsTable.date))
    .limit(50);

  res.json({
    userId,
    weightProgress,
    bodyFatProgress,
    attendanceCount: attendanceRow?.count ?? 0,
    totalSets: setsRow?.count ?? 0,
    exerciseLogs,
  });
});

router.get("/analytics/attendance", authenticate, requireAdmin, async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [];
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    conditions.push(gte(checkinsTable.timestamp, new Date(`${from}T00:00:00.000Z`)));
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const next = new Date(`${to}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    conditions.push(lte(checkinsTable.timestamp, next));
  }

  const dayCol = sql<string>`TO_CHAR(${checkinsTable.timestamp}::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ date: dayCol, count: count() })
    .from(checkinsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(dayCol)
    .orderBy(dayCol);

  res.json(rows);
});

// ── Monthly report for member ────────────────────────────────────────────────
router.get("/analytics/monthly-report", authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const m = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
  const y = parseInt(String(req.query.year)) || new Date().getFullYear();
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;

  try {
    const [setsRow] = await db
      .select({ c: count() })
      .from(exerciseLogsTable)
      .where(
        and(
          eq(exerciseLogsTable.userId, userId),
          gte(exerciseLogsTable.date, monthStart),
          lte(exerciseLogsTable.date, monthEnd),
        ),
      );

    const [checkinRow] = await db
      .select({ c: count() })
      .from(checkinsTable)
      .where(
        and(
          eq(checkinsTable.userId, userId),
          gte(checkinsTable.timestamp, new Date(`${monthStart}T00:00:00Z`)),
          lte(checkinsTable.timestamp, new Date(`${monthEnd}T23:59:59Z`)),
        ),
      );

    const [uniqueDays] = await db
      .select({ c: sql<number>`count(DISTINCT date)::int` })
      .from(exerciseLogsTable)
      .where(
        and(
          eq(exerciseLogsTable.userId, userId),
          gte(exerciseLogsTable.date, monthStart),
          lte(exerciseLogsTable.date, monthEnd),
        ),
      );

    const [maxW] = await db
      .select({ w: sql<number>`COALESCE(MAX(CAST(weight AS NUMERIC)), 0)` })
      .from(exerciseLogsTable)
      .where(
        and(
          eq(exerciseLogsTable.userId, userId),
          gte(exerciseLogsTable.date, monthStart),
          lte(exerciseLogsTable.date, monthEnd),
        ),
      );

    const bodyStats = await db
      .select()
      .from(bodyStatsTable)
      .where(
        and(
          eq(bodyStatsTable.userId, userId),
          gte(bodyStatsTable.date, monthStart),
          lte(bodyStatsTable.date, monthEnd),
        ),
      )
      .orderBy(bodyStatsTable.date);

    const firstWeight = bodyStats.find((s) => s.weight != null)?.weight;
    const lastWeight = [...bodyStats].reverse().find((s) => s.weight != null)?.weight;

    res.json({
      month: m,
      year: y,
      totalSets: setsRow?.c ?? 0,
      attendanceDays: checkinRow?.c ?? 0,
      trainingDays: uniqueDays?.c ?? 0,
      maxWeight: Number(maxW?.w ?? 0),
      weightStart: firstWeight ? Number(firstWeight) : null,
      weightEnd: lastWeight ? Number(lastWeight) : null,
      weightChange: firstWeight && lastWeight ? Number(lastWeight) - Number(firstWeight) : null,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
