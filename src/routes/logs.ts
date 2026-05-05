import { Router } from "express";
import { db } from "@workspace/db";
import { exerciseLogsTable, bodyStatsTable, checkinsTable, exercisesTable, usersTable, progressPhotosTable } from "@workspace/db/schema";
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
          targetMuscle: exercisesTable.targetMuscle,
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
    // Check previous max weight for PR detection
    const prevLogs = await db.select({ weight: exerciseLogsTable.weight })
      .from(exerciseLogsTable)
      .where(and(
        eq(exerciseLogsTable.userId, req.user!.userId),
        eq(exerciseLogsTable.exerciseId, body.data.exerciseId),
      ));
    const prevMax = prevLogs.reduce((max, l) => Math.max(max, parseFloat(l.weight) || 0), 0);

    const [log] = await db.insert(exerciseLogsTable).values({
      userId: req.user!.userId,
      exerciseId: body.data.exerciseId,
      setNumber: body.data.setNumber,
      reps: body.data.reps,
      weight: String(body.data.weight),
      date: body.data.date,
    }).returning();
    const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, log.exerciseId)).limit(1);
    const isPR = body.data.weight > 0 && body.data.weight > prevMax;
    res.status(201).json({ ...log, exercise, isPR, previousMax: prevMax });
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

// ─── Personal Records ─────────────────────────────────────────────────────────

router.get("/personal-records", authenticate, async (req, res) => {
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : req.user!.userId;
  if (targetUserId === null) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const logs = await db
      .select({
        exerciseId: exerciseLogsTable.exerciseId,
        weight: exerciseLogsTable.weight,
        reps: exerciseLogsTable.reps,
        date: exerciseLogsTable.date,
        exerciseName: exercisesTable.name,
        targetMuscle: exercisesTable.targetMuscle,
      })
      .from(exerciseLogsTable)
      .innerJoin(exercisesTable, eq(exerciseLogsTable.exerciseId, exercisesTable.id))
      .where(eq(exerciseLogsTable.userId, targetUserId));

    // Group by exercise, find max weight
    const byExercise: Record<number, { exerciseId: number; exerciseName: string; targetMuscle: string; maxWeight: number; maxReps: number; date: string; totalSets: number }> = {};
    for (const l of logs) {
      const w = parseFloat(l.weight) || 0;
      if (!byExercise[l.exerciseId]) {
        byExercise[l.exerciseId] = { exerciseId: l.exerciseId, exerciseName: l.exerciseName, targetMuscle: l.targetMuscle, maxWeight: w, maxReps: l.reps, date: l.date, totalSets: 1 };
      } else {
        byExercise[l.exerciseId].totalSets++;
        if (w > byExercise[l.exerciseId].maxWeight) {
          byExercise[l.exerciseId].maxWeight = w;
          byExercise[l.exerciseId].maxReps = l.reps;
          byExercise[l.exerciseId].date = l.date;
        }
      }
    }
    const prs = Object.values(byExercise).sort((a, b) => b.maxWeight - a.maxWeight);
    res.json(prs);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأرقام الشخصية" });
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

// ─── Progress photos ──────────────────────────────────────────────────────────

const progressPhotoSchema = z.object({
  photoUrl: z.string().min(1),
  category: z.enum(["front", "side", "back"]).default("front"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).nullable().optional(),
});

router.get("/progress-photos", authenticate, async (req, res) => {
  const targetUserId = req.query.userId
    ? parseUserId(String(req.query.userId), res)
    : req.user!.userId;
  if (targetUserId === null) return;
  if (req.user!.role !== "admin" && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const photos = await db.select().from(progressPhotosTable)
      .where(eq(progressPhotosTable.userId, targetUserId))
      .orderBy(desc(progressPhotosTable.date));
    res.json(photos);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/progress-photos", authenticate, async (req, res) => {
  const body = progressPhotoSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [photo] = await db.insert(progressPhotosTable).values({
      userId: req.user!.userId,
      photoUrl: body.data.photoUrl,
      category: body.data.category,
      date: body.data.date,
      note: body.data.note ?? null,
    }).returning();
    res.status(201).json(photo);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/progress-photos/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res, "photo id");
  if (!id) return;
  try {
    await db.delete(progressPhotosTable).where(and(
      eq(progressPhotosTable.id, id),
      eq(progressPhotosTable.userId, req.user!.userId),
    ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
