import { Router } from "express";
import { db } from "@workspace/db";
import {
  waterLogsTable,
  sessionRatingsTable,
  chatMessagesTable,
  notificationsTable,
  mealPlansTable,
  mealPlanItemsTable,
  usersTable,
  exerciseLogsTable,
  checkinsTable,
  bodyStatsTable,
  coachNotesTable,
} from "@workspace/db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parseUserId, parsePagination } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

/**
 * Chat is intentionally only allowed between an admin and a member. Members
 * messaging each other (or admins messaging admins) was never a product
 * requirement and would let any logged-in user spam any other account.
 */
async function ensureChatAllowed(
  myId: string,
  myRole: string,
  otherId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (myId === otherId) {
    return { ok: false, status: 400, message: "لا يمكن إرسال رسالة لنفسك" };
  }
  const [other] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, otherId))
    .limit(1);
  if (!other) {
    return { ok: false, status: 404, message: "المستخدم غير موجود" };
  }
  const otherRole = other.role.toLowerCase();
  const meIsAdmin = myRole.toLowerCase() === "admin";
  const otherIsAdmin = otherRole === "admin";
  if (meIsAdmin === otherIsAdmin) {
    return { ok: false, status: 403, message: "غير مسموح بإرسال رسائل لهذا المستخدم" };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATER TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/water", authenticate, async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().split("T")[0];
  try {
    const [row] = await db
      .select()
      .from(waterLogsTable)
      .where(and(eq(waterLogsTable.userId, req.user!.userId), eq(waterLogsTable.date, date)));
    res.json({ glasses: row?.glasses ?? 0, date });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

const waterSchema = z.object({
  glasses: z.number().int().min(0).max(50),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

router.post("/water", authenticate, async (req, res) => {
  const parsed = waterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const { glasses } = parsed.data;
  const d = parsed.data.date || new Date().toISOString().split("T")[0];
  try {
    const [existing] = await db
      .select()
      .from(waterLogsTable)
      .where(and(eq(waterLogsTable.userId, req.user!.userId), eq(waterLogsTable.date, d)));
    if (existing) {
      const [updated] = await db
        .update(waterLogsTable)
        .set({ glasses })
        .where(eq(waterLogsTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(waterLogsTable)
        .values({ userId: req.user!.userId, glasses, date: d })
        .returning();
      res.status(201).json(created);
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION RATINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/session-rating", authenticate, async (req, res) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    note: z.string().max(500).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح"),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [r] = await db
      .insert(sessionRatingsTable)
      .values({
        userId: req.user!.userId,
        rating: body.data.rating,
        note: body.data.note ?? null,
        date: body.data.date,
      })
      .returning();
    res.status(201).json(r);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/session-ratings", authenticate, async (req, res) => {
  try {
    const ratings = await db
      .select()
      .from(sessionRatingsTable)
      .where(eq(sessionRatingsTable.userId, req.user!.userId))
      .orderBy(desc(sessionRatingsTable.date))
      .limit(30);
    res.json(ratings);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/chat/:otherId", authenticate, async (req, res) => {
  const otherId = parseUserId(req.params.otherId, res);
  if (!otherId) return;
  const myId = req.user!.userId;
  const myRole = req.user!.role;
  try {
    const allowed = await ensureChatAllowed(myId, myRole, otherId);
    if (!allowed.ok) {
      res.status(allowed.status).json({ error: "Forbidden", message: allowed.message });
      return;
    }
    const messages = await db
      .select({
        id: chatMessagesTable.id,
        senderId: chatMessagesTable.senderId,
        receiverId: chatMessagesTable.receiverId,
        message: chatMessagesTable.message,
        read: chatMessagesTable.read,
        createdAt: chatMessagesTable.createdAt,
      })
      .from(chatMessagesTable)
      .where(
        or(
          and(eq(chatMessagesTable.senderId, myId), eq(chatMessagesTable.receiverId, otherId)),
          and(eq(chatMessagesTable.senderId, otherId), eq(chatMessagesTable.receiverId, myId)),
        ),
      )
      .orderBy(chatMessagesTable.createdAt)
      .limit(200);
    await db
      .update(chatMessagesTable)
      .set({ read: 1 })
      .where(
        and(
          eq(chatMessagesTable.senderId, otherId),
          eq(chatMessagesTable.receiverId, myId),
          eq(chatMessagesTable.read, 0),
        ),
      );
    res.json(messages);
  } catch (err) {
    logger.error({ err, myId, otherId }, "GET /chat failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

const chatPostSchema = z.object({
  message: z.string().min(1).max(2000),
});

router.post("/chat/:otherId", authenticate, async (req, res) => {
  const otherId = parseUserId(req.params.otherId, res);
  if (!otherId) return;
  const parsed = chatPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: "الرسالة مطلوبة (حد أقصى 2000 حرف)" });
    return;
  }
  const trimmed = parsed.data.message.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Validation error", message: "الرسالة فارغة" });
    return;
  }
  try {
    const allowed = await ensureChatAllowed(req.user!.userId, req.user!.role, otherId);
    if (!allowed.ok) {
      res.status(allowed.status).json({ error: "Forbidden", message: allowed.message });
      return;
    }
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        senderId: req.user!.userId,
        receiverId: otherId,
        message: trimmed,
      })
      .returning();
    res.status(201).json(msg);
  } catch (err) {
    logger.error({ err, otherId }, "POST /chat failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat-contacts", authenticate, async (req, res) => {
  const myId = req.user!.userId;
  const targetRole = req.user!.role.toLowerCase() === "admin" ? "member" : "admin";
  // Default to a generous page size so existing UI keeps working, but cap to
  // 200 so a single admin doesn't hammer the DB if the gym has thousands of
  // members.
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit, 200);
  try {
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.role, targetRole))
      .orderBy(usersTable.name)
      .limit(limit)
      .offset(offset);
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, targetRole));
    const unread = await db
      .select({
        senderId: chatMessagesTable.senderId,
        count: sql<number>`count(*)::int`,
      })
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.receiverId, myId), eq(chatMessagesTable.read, 0)))
      .groupBy(chatMessagesTable.senderId);
    const unreadMap: Record<string, number> = {};
    unread.forEach((u) => {
      unreadMap[u.senderId] = u.count;
    });
    res.json({
      data: users.map((u) => ({ ...u, unread: unreadMap[u.id] ?? 0 })),
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error({ err }, "GET /chat-contacts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/notifications", authenticate, async (req, res) => {
  try {
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(notifs);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/read-all", authenticate, async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ read: 1 })
      .where(and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.read, 0)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: send notification to user
router.post("/notifications/send", authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({
    userId: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    body: z.string().max(2000).optional(),
    type: z.string().max(50).optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [n] = await db
      .insert(notificationsTable)
      .values({
        userId: body.data.userId,
        title: body.data.title,
        body: body.data.body ?? null,
        type: body.data.type ?? "general",
      })
      .returning();
    res.status(201).json(n);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL PLANS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/meal-plans", authenticate, async (req, res) => {
  const targetUserId = req.query.userId ? parseUserId(String(req.query.userId), res) : req.user!.userId;
  if (!targetUserId) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const plans = await db
      .select()
      .from(mealPlansTable)
      .where(eq(mealPlansTable.userId, targetUserId))
      .orderBy(desc(mealPlansTable.createdAt));
    if (plans.length === 0) {
      res.json([]);
      return;
    }
    // Single batched fetch instead of one query per plan.
    const planIds = plans.map((p) => p.id);
    const items = await db
      .select()
      .from(mealPlanItemsTable)
      .where(sql`${mealPlanItemsTable.planId} = ANY(${planIds})`)
      .orderBy(mealPlanItemsTable.sortOrder);
    const itemsByPlan = new Map<number, typeof items>();
    for (const item of items) {
      const arr = itemsByPlan.get(item.planId) ?? [];
      arr.push(item);
      itemsByPlan.set(item.planId, arr);
    }
    res.json(plans.map((p) => ({ ...p, items: itemsByPlan.get(p.id) ?? [] })));
  } catch (err) {
    logger.error({ err, targetUserId }, "GET /meal-plans failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/meal-plans", authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    name: z.string(),
    notes: z.string().optional(),
    items: z
      .array(
        z.object({
          mealName: z.string().min(1).max(200),
          time: z.string().max(20).optional(),
          calories: z.number().min(0).max(100_000).optional(),
          protein: z.number().min(0).max(100_000).optional(),
          carbs: z.number().min(0).max(100_000).optional(),
          fats: z.number().min(0).max(100_000).optional(),
          description: z.string().max(1000).optional(),
        }),
      )
      .max(100)
      .optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [plan] = await db
      .insert(mealPlansTable)
      .values({
        userId: body.data.userId,
        name: body.data.name,
        notes: body.data.notes ?? null,
      })
      .returning();
    if (body.data.items?.length) {
      for (let i = 0; i < body.data.items.length; i++) {
        const item = body.data.items[i];
        await db.insert(mealPlanItemsTable).values({
          planId: plan.id,
          mealName: item.mealName,
          time: item.time ?? null,
          calories: item.calories ?? null,
          protein: item.protein ?? null,
          carbs: item.carbs ?? null,
          fats: item.fats ?? null,
          description: item.description ?? null,
          sortOrder: i,
        });
      }
    }
    res.status(201).json(plan);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/meal-plans/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  try {
    await db.delete(mealPlansTable).where(eq(mealPlansTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "DELETE /meal-plans failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/leaderboard", authenticate, async (req, res) => {
  try {
    // Single aggregating query — the previous implementation issued 2 queries
    // per user (O(2N) round trips), which became prohibitive once the gym had
    // more than a few dozen members.
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.name,
        COALESCE(s.sessions, 0)::int AS sessions,
        COALESCE(v.volume, 0)::int  AS volume
      FROM "User" u
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT date) AS sessions
          FROM exercise_logs
          GROUP BY user_id
      ) s ON s.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COALESCE(SUM(CAST(weight AS NUMERIC) * reps), 0) AS volume
          FROM exercise_logs
          GROUP BY user_id
      ) v ON v.user_id = u.id
      WHERE u.role = 'member'
      ORDER BY volume DESC, sessions DESC, u.name ASC
      LIMIT 100
    `);
    res.json(rows.rows ?? rows);
  } catch (err) {
    logger.error({ err }, "GET /leaderboard failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BADGES / ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/badges", authenticate, async (req, res) => {
  const uid = req.user!.userId;
  try {
    const [logCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(exerciseLogsTable)
      .where(eq(exerciseLogsTable.userId, uid));
    const [checkinCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(eq(checkinsTable.userId, uid));
    const [uniqueDays] = await db
      .select({ c: sql<number>`count(DISTINCT date)::int` })
      .from(exerciseLogsTable)
      .where(eq(exerciseLogsTable.userId, uid));
    const [maxWeight] = await db
      .select({ w: sql<number>`COALESCE(MAX(CAST(weight AS NUMERIC)), 0)` })
      .from(exerciseLogsTable)
      .where(eq(exerciseLogsTable.userId, uid));
    const [statsCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(bodyStatsTable)
      .where(eq(bodyStatsTable.userId, uid));

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
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COACH NOTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/coach-notes/:userId", authenticate, async (req, res) => {
  const targetUserId = parseUserId(req.params.userId, res);
  if (!targetUserId) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const notes = await db
      .select()
      .from(coachNotesTable)
      .where(eq(coachNotesTable.userId, targetUserId))
      .orderBy(desc(coachNotesTable.createdAt))
      .limit(50);
    res.json(notes);
  } catch (err) {
    logger.error({ err, targetUserId }, "GET /coach-notes failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/coach-notes", authenticate, requireAdmin, async (req, res) => {
  const schema = z.object({ userId: z.string().min(1), note: z.string().min(1).max(2000) });
  const body = schema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [n] = await db
      .insert(coachNotesTable)
      .values({ userId: body.data.userId, note: body.data.note })
      .returning();
    res.status(201).json(n);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/coach-notes/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  try {
    await db.delete(coachNotesTable).where(eq(coachNotesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "DELETE /coach-notes failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
