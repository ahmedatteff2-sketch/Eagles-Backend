import { Router } from "express";
import { db } from "@workspace/db";
import { exerciseLogsTable, bodyStatsTable, checkinsTable, exercisesTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parseUserId } from "../lib/params.js";
import { z } from "zod";

const router = Router();

const exerciseLogSchema = z.object({
  exerciseId: z.number().int().min(1).max(2_147_483_647),
  setNumber: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(10000),
  weight: z.number().min(0).max(10000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح"),
});

const bodyStatSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تنسيق التاريخ غير صحيح"),
  weight: z.number().min(0).max(999).nullable().optional(),
  bodyFat: z.number().min(0).max(100).nullable().optional(),
  dietNote: z.string().max(1000).nullable().optional(),
  performanceNote: z.string().max(1000).nullable().optional(),
});

const checkinSchema = z.object({
  userId: z.string().min(1).max(64),
});

// ─── Exercise logs ────────────────────────────────────────────────────────────

router.get("/exercise-logs", authenticate, async (req, res) => {
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : req.user!.userId;
  if (targetUserId === null) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const exerciseId = req.query.exerciseId ? Number(req.query.exerciseId) : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  try {
    const conditions: ReturnType<typeof eq>[] = [eq(exerciseLogsTable.userId, targetUserId)];
    if (exerciseId && Number.isInteger(exerciseId) && exerciseId > 0) conditions.push(eq(exerciseLogsTable.exerciseId, exerciseId));
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conditions.push(gte(exerciseLogsTable.date, from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conditions.push(lte(exerciseLogsTable.date, to));

    const logs = await db
      .select({
        id: exerciseLogsTable.id,
        userId: exerciseLogsTable.userId,
        exerciseId: exerciseLogsTable.exerciseId,
        setNumber: exerciseLogsTable.setNumber,
        reps: exerciseLogsTable.reps,
        weight: exerciseLogsTable.weight,
        date: exerciseLogsTable.date,
        exercise: {
          id: exercisesTable.id,
          name: exercisesTable.name,
          videoUrl: exercisesTable.videoUrl,
          setsRequired: exercisesTable.setsRequired,
          repsMin: exercisesTable.repsMin,
          repsMax: exercisesTable.repsMax,
          weekId: exercisesTable.weekId,
        },
      })
      .from(exerciseLogsTable)
      .innerJoin(exercisesTable, eq(exerciseLogsTable.exerciseId, exercisesTable.id))
      .where(and(...conditions))
      .orderBy(desc(exerciseLogsTable.date));

    res.json(logs);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجلات" });
  }
});

router.post("/exercise-logs", authenticate, async (req, res) => {
  const body = exerciseLogSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [log] = await db.insert(exerciseLogsTable).values({
      userId: req.user!.userId,
      exerciseId: body.data.exerciseId,
      setNumber: body.data.setNumber,
      reps: body.data.reps,
      weight: String(body.data.weight),
      date: body.data.date,
    }).returning();
    const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, log.exerciseId)).limit(1);
    res.status(201).json({ ...log, exercise });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تسجيل الأداء" });
  }
});

router.delete("/exercise-logs/:logId", authenticate, async (req, res) => {
  const logId = parseId(req.params.logId, res, "معرّف السجل");
  if (!logId) return;

  try {
    await db.delete(exerciseLogsTable).where(and(
      eq(exerciseLogsTable.id, logId),
      eq(exerciseLogsTable.userId, req.user!.userId)
    ));
    res.json({ success: true, message: "تم حذف السجل" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

// ─── Body stats ───────────────────────────────────────────────────────────────

router.get("/body-stats", authenticate, async (req, res) => {
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : req.user!.userId;
  if (targetUserId === null) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  try {
    const conditions: ReturnType<typeof eq>[] = [eq(bodyStatsTable.userId, targetUserId)];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conditions.push(gte(bodyStatsTable.date, from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conditions.push(lte(bodyStatsTable.date, to));

    const stats = await db.select().from(bodyStatsTable).where(and(...conditions)).orderBy(bodyStatsTable.date);
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب البيانات" });
  }
});

router.post("/body-stats", authenticate, async (req, res) => {
  const body = bodyStatSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [stat] = await db.insert(bodyStatsTable).values({
      userId: req.user!.userId,
      date: body.data.date,
      weight: body.data.weight != null ? String(body.data.weight) : null,
      bodyFat: body.data.bodyFat != null ? String(body.data.bodyFat) : null,
      dietNote: body.data.dietNote ?? null,
      performanceNote: body.data.performanceNote ?? null,
    }).returning();
    res.status(201).json(stat);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تسجيل البيانات" });
  }
});

router.delete("/body-stats/:statId", authenticate, async (req, res) => {
  const statId = parseId(req.params.statId, res, "معرّف السجل");
  if (!statId) return;

  try {
    await db.delete(bodyStatsTable).where(and(
      eq(bodyStatsTable.id, statId),
      eq(bodyStatsTable.userId, req.user!.userId)
    ));
    res.json({ success: true, message: "تم حذف السجل" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

// ─── Check-ins ────────────────────────────────────────────────────────────────

router.get("/checkins", authenticate, async (req, res) => {
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : (req.user!.role === "member" ? req.user!.userId : undefined);

  if (req.query.userId && targetUserId === null) return;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  try {
    const conditions = [];
    if (targetUserId) conditions.push(eq(checkinsTable.userId, targetUserId));
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conditions.push(gte(checkinsTable.timestamp, new Date(`${from}T00:00:00.000Z`)));
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const next = new Date(`${to}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      conditions.push(lte(checkinsTable.timestamp, next));
    }

    const checkins = await db
      .select({
        id: checkinsTable.id,
        userId: checkinsTable.userId,
        timestamp: checkinsTable.timestamp,
        userName: usersTable.name,
      })
      .from(checkinsTable)
      .innerJoin(usersTable, eq(checkinsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(checkinsTable.timestamp));

    res.json(checkins);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الحضور" });
  }
});

router.post("/checkins", authenticate, requireAdmin, async (req, res) => {
  const body = checkinSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    // Check if checkin exists for TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(checkinsTable)
      .where(and(eq(checkinsTable.userId, body.data.userId), gte(checkinsTable.timestamp, today)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "تم تسجيل الحضور مسبقاً" });
      return;
    }

    const [checkin] = await db.insert(checkinsTable).values({
      id: crypto.randomUUID(),
      userId: body.data.userId,
      method: "MANUAL",
      timestamp: new Date()
    }).returning();
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, checkin.userId)).limit(1);
    res.status(201).json({ ...checkin, userName: user?.name ?? "" });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تسجيل الحضور" });
  }
});

export default router;
