import { Router } from "express";
import { db } from "@workspace/db";
import {
  waterLogsTable, sessionRatingsTable, chatMessagesTable,
  notificationsTable, mealPlansTable, mealPlanItemsTable, usersTable,
  exerciseLogsTable, checkinsTable, bodyStatsTable,
  memberSubscriptionsTable,
} from "@workspace/db/schema";
import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// WATER TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/water", authenticate, async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().split("T")[0];
  try {
    const [row] = await db.select().from(waterLogsTable)
      .where(and(eq(waterLogsTable.userId, req.user!.userId), eq(waterLogsTable.date, date)));
    res.json({ glasses: row?.glasses ?? 0, date });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.post("/water", authenticate, async (req, res) => {
  const { glasses, date } = req.body;
  const d = date || new Date().toISOString().split("T")[0];
  try {
    const [existing] = await db.select().from(waterLogsTable)
      .where(and(eq(waterLogsTable.userId, req.user!.userId), eq(waterLogsTable.date, d)));
    if (existing) {
      const [updated] = await db.update(waterLogsTable).set({ glasses }).where(eq(waterLogsTable.id, existing.id)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(waterLogsTable).values({ userId: req.user!.userId, glasses, date: d }).returning();
      res.status(201).json(created);
    }
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE STREAK
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/streak", authenticate, async (req, res) => {
  try {
    const checkins = await db
      .select({ timestamp: checkinsTable.timestamp })
      .from(checkinsTable)
      .where(eq(checkinsTable.userId, req.user!.userId))
      .orderBy(desc(checkinsTable.timestamp));

    // Get unique dates
    const dates = [...new Set(
      checkins.map(c => new Date(c.timestamp).toISOString().split("T")[0])
    )].sort((a, b) => b.localeCompare(a)); // newest first

    if (dates.length === 0) {
      res.json({ streak: 0, longestStreak: 0, totalDays: 0 });
      return;
    }

    // Calculate current streak
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    let streak = 0;

    // Streak starts only if user checked in today or yesterday
    if (dates[0] === today || dates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak ever
    let longestStreak = 1;
    let currentRun = 1;
    const sorted = [...dates].sort(); // oldest first
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        currentRun++;
        if (currentRun > longestStreak) longestStreak = currentRun;
      } else {
        currentRun = 1;
      }
    }

    res.json({ streak, longestStreak, totalDays: dates.length });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION RATINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/session-rating", authenticate, async (req, res) => {
  const schema = z.object({ rating: z.number().int().min(1).max(5), note: z.string().max(500).optional(), date: z.string() });
  const body = schema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  try {
    const [r] = await db.insert(sessionRatingsTable).values({
      userId: req.user!.userId, rating: body.data.rating, note: body.data.note ?? null, date: body.data.date,
    }).returning();
    res.status(201).json(r);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.get("/session-ratings", authenticate, async (req, res) => {
  try {
    const ratings = await db.select().from(sessionRatingsTable)
      .where(eq(sessionRatingsTable.userId, req.user!.userId))
      .orderBy(desc(sessionRatingsTable.date)).limit(30);
    res.json(ratings);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/chat/:otherId", authenticate, async (req, res) => {
  const otherId = req.params.otherId;
  const myId = req.user!.userId;
  try {
    const messages = await db.select({
      id: chatMessagesTable.id,
      senderId: chatMessagesTable.senderId,
      receiverId: chatMessagesTable.receiverId,
      message: chatMessagesTable.message,
      read: chatMessagesTable.read,
      createdAt: chatMessagesTable.createdAt,
    }).from(chatMessagesTable).where(
      or(
        and(eq(chatMessagesTable.senderId, myId), eq(chatMessagesTable.receiverId, otherId)),
        and(eq(chatMessagesTable.senderId, otherId), eq(chatMessagesTable.receiverId, myId)),
      )
    ).orderBy(chatMessagesTable.createdAt).limit(200);
    // Mark as read
    await db.update(chatMessagesTable).set({ read: 1 }).where(
      and(eq(chatMessagesTable.senderId, otherId), eq(chatMessagesTable.receiverId, myId), eq(chatMessagesTable.read, 0))
    );
    res.json(messages);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.post("/chat/:otherId", authenticate, async (req, res) => {
  const otherId = req.params.otherId;
  const { message } = req.body;
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }
  try {
    const [msg] = await db.insert(chatMessagesTable).values({
      senderId: req.user!.userId, receiverId: otherId, message: message.trim(),
    }).returning();
    res.status(201).json(msg);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.get("/chat-contacts", authenticate, async (req, res) => {
  const myId = req.user!.userId;
  try {
    // Get users who have chatted with me, or if admin, get all members
    if (req.user!.role === "admin") {
      const users = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "member"));
      // Count unread per user
      const unread = await db.select({
        senderId: chatMessagesTable.senderId,
        count: sql<number>`count(*)::int`,
      }).from(chatMessagesTable)
        .where(and(eq(chatMessagesTable.receiverId, myId), eq(chatMessagesTable.read, 0)))
        .groupBy(chatMessagesTable.senderId);
      const unreadMap: Record<string, number> = {};
      unread.forEach(u => { unreadMap[u.senderId] = u.count; });
      res.json(users.map(u => ({ ...u, unread: unreadMap[u.id] ?? 0 })));
    } else {
      // Member: get admins
      const admins = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "admin"));
      const unread = await db.select({
        senderId: chatMessagesTable.senderId,
        count: sql<number>`count(*)::int`,
      }).from(chatMessagesTable)
        .where(and(eq(chatMessagesTable.receiverId, myId), eq(chatMessagesTable.read, 0)))
        .groupBy(chatMessagesTable.senderId);
      const unreadMap: Record<string, number> = {};
      unread.forEach(u => { unreadMap[u.senderId] = u.count; });
      res.json(admins.map(u => ({ ...u, unread: unreadMap[u.id] ?? 0 })));
    }
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/notifications", authenticate, async (req, res) => {
  try {
    const notifs = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.userId))
      .orderBy(desc(notificationsTable.createdAt)).limit(50);
    res.json(notifs);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.post("/notifications/read-all", authenticate, async (req, res) => {
  try {
    await db.update(notificationsTable).set({ read: 1 })
      .where(and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.read, 0)));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// Admin: send notification to user
router.post("/notifications/send", authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({ userId: z.string(), title: z.string(), body: z.string().optional(), type: z.string().optional() });
  const body = schema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  try {
    const [n] = await db.insert(notificationsTable).values({
      userId: body.data.userId, title: body.data.title, body: body.data.body ?? null, type: body.data.type ?? "general",
    }).returning();
    res.status(201).json(n);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// Admin: auto-create notifications for members whose subscription expires in ≤ N days
router.post("/notifications/expiring", authenticate, requireAdmin, async (req, res) => {
  const days = Number(req.body.days) || 3;
  try {
    const today = new Date().toISOString().split("T")[0];
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

    const expiring = await db
      .select({ userId: memberSubscriptionsTable.userId, endDate: memberSubscriptionsTable.endDate, name: usersTable.name })
      .from(memberSubscriptionsTable)
      .innerJoin(usersTable, eq(memberSubscriptionsTable.userId, usersTable.id))
      .where(and(
        eq(memberSubscriptionsTable.status, "active"),
        gte(memberSubscriptionsTable.endDate, today),
        lte(memberSubscriptionsTable.endDate, cutoff),
      ));

    let created = 0;
    for (const m of expiring) {
      const daysLeft = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
      // Check if already notified today
      const [existing] = await db.select({ id: notificationsTable.id }).from(notificationsTable)
        .where(and(
          eq(notificationsTable.userId, m.userId),
          eq(notificationsTable.type, "subscription_expiry"),
          gte(notificationsTable.createdAt, new Date(today)),
        )).limit(1);
      if (existing) continue;

      await db.insert(notificationsTable).values({
        userId: m.userId,
        title: daysLeft <= 0 ? "⚠️ اشتراكك انتهى اليوم!" : `⚠️ اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`,
        body: "جدد اشتراكك للاستمرار في التمرين",
        type: "subscription_expiry",
      });
      created++;
    }
    res.json({ success: true, notified: created, total: expiring.length });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL PLANS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/meal-plans", authenticate, async (req, res) => {
  const targetUserId = req.query.userId ? String(req.query.userId) : req.user!.userId;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  try {
    const plans = await db.select().from(mealPlansTable).where(eq(mealPlansTable.userId, targetUserId)).orderBy(desc(mealPlansTable.createdAt));
    const result = [];
    for (const p of plans) {
      const items = await db.select().from(mealPlanItemsTable).where(eq(mealPlanItemsTable.planId, p.id)).orderBy(mealPlanItemsTable.sortOrder);
      result.push({ ...p, items });
    }
    res.json(result);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.post("/meal-plans", authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({
    userId: z.string(), name: z.string(), notes: z.string().optional(),
    items: z.array(z.object({
      mealName: z.string(), time: z.string().optional(), calories: z.number().optional(),
      protein: z.number().optional(), carbs: z.number().optional(), fats: z.number().optional(),
      description: z.string().optional(),
    })).optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  try {
    const [plan] = await db.insert(mealPlansTable).values({
      userId: body.data.userId, name: body.data.name, notes: body.data.notes ?? null,
    }).returning();
    if (body.data.items?.length) {
      for (let i = 0; i < body.data.items.length; i++) {
        const item = body.data.items[i];
        await db.insert(mealPlanItemsTable).values({
          planId: plan.id, mealName: item.mealName, time: item.time ?? null,
          calories: item.calories ?? null, protein: item.protein ?? null,
          carbs: item.carbs ?? null, fats: item.fats ?? null,
          description: item.description ?? null, sortOrder: i,
        });
      }
    }
    res.status(201).json(plan);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/meal-plans/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(mealPlansTable).where(eq(mealPlansTable.id, id));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/leaderboard", authenticate, async (req, res) => {
  try {
    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.role, "member"));
    const result = [];
    for (const u of users) {
      const [logCount] = await db.select({ count: sql<number>`count(DISTINCT date)::int` }).from(
        sql`(SELECT DISTINCT date FROM exercise_logs WHERE user_id = ${u.id}) t`
      );
      const [totalVol] = await db.select({
        vol: sql<number>`COALESCE(SUM(CAST(weight AS NUMERIC) * reps), 0)::int`,
      }).from(sql`exercise_logs`).where(sql`user_id = ${u.id}`);
      result.push({ id: u.id, name: u.name, sessions: logCount?.count ?? 0, volume: totalVol?.vol ?? 0 });
    }
    result.sort((a, b) => b.volume - a.volume);
    res.json(result);
  } catch (e) { res.status(500).json({ error: "Internal server error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BADGES / ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/badges", authenticate, async (req, res) => {
  const uid = req.user!.userId;
  try {
    const [logCount] = await db.select({ c: sql<number>`count(*)::int` }).from(exerciseLogsTable).where(eq(exerciseLogsTable.userId, uid));
    const [checkinCount] = await db.select({ c: sql<number>`count(*)::int` }).from(checkinsTable).where(eq(checkinsTable.userId, uid));
    const [uniqueDays] = await db.select({ c: sql<number>`count(DISTINCT date)::int` }).from(exerciseLogsTable).where(eq(exerciseLogsTable.userId, uid));
    const [maxWeight] = await db.select({ w: sql<number>`COALESCE(MAX(CAST(weight AS NUMERIC)), 0)` }).from(exerciseLogsTable).where(eq(exerciseLogsTable.userId, uid));
    const [statsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(bodyStatsTable).where(eq(bodyStatsTable.userId, uid));

    const logs = logCount?.c ?? 0;
    const checkins = checkinCount?.c ?? 0;
    const days = uniqueDays?.c ?? 0;
    const mw = Number(maxWeight?.w ?? 0);
    const stats = statsCount?.c ?? 0;

    const badges = [
      { id: "first_log", name: "البداية", desc: "سجّل أول تمرين", icon: "🏋️", earned: logs >= 1 },
      { id: "10_logs", name: "مثابر", desc: "سجّل 10 مجموعات", icon: "💪", earned: logs >= 10 },
      { id: "50_logs", name: "وحش", desc: "سجّل 50 مجموعة", icon: "🔥", earned: logs >= 50 },
      { id: "100_logs", name: "أسطورة", desc: "سجّل 100 مجموعة", icon: "⚡", earned: logs >= 100 },
      { id: "first_checkin", name: "حاضر", desc: "أول حضور", icon: "✅", earned: checkins >= 1 },
      { id: "10_checkins", name: "منتظم", desc: "10 أيام حضور", icon: "📅", earned: checkins >= 10 },
      { id: "30_checkins", name: "ملتزم", desc: "30 يوم حضور", icon: "🗓️", earned: checkins >= 30 },
      { id: "7_days", name: "أسبوع كامل", desc: "تدرّب 7 أيام مختلفة", icon: "🎯", earned: days >= 7 },
      { id: "30_days", name: "شهر كامل", desc: "تدرّب 30 يوم", icon: "🏅", earned: days >= 30 },
      { id: "heavy50", name: "خمسيناتي", desc: "ارفع 50 كجم في تمرين", icon: "🏆", earned: mw >= 50 },
      { id: "heavy100", name: "مائوي", desc: "ارفع 100 كجم في تمرين", icon: "👑", earned: mw >= 100 },
      { id: "track_body", name: "واعي", desc: "سجّل قياسات جسمك", icon: "📊", earned: stats >= 1 },
    ];
    res.json(badges);
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

export default router;
