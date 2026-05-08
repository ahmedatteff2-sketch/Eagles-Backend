import { Router } from "express";
import { db } from "@workspace/db";
import {
  exercisesTable,
  workoutTemplatesTable,
  workoutTemplateExercisesTable,
  memberWorkoutAssignmentsTable,
} from "@workspace/db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parseUserId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

// Mirror the table's row type so partial updates stay type-safe — using
// `any` here historically swallowed typos like `daysCount` vs `daysCount` and
// any future column rename would silently no-op.
type WorkoutTemplateUpdate = Partial<typeof workoutTemplatesTable.$inferInsert>;

const exerciseSchema = z.object({
  name: z.string().min(1),
  videoUrl: z.string().nullable().optional(),
  targetMuscle: z.string().min(1),
});

const templateSchema = z.object({
  name: z.string().min(1),
  daysCount: z.number().int().min(1).max(14).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  dayNames: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const templateExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  dayNumber: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  restSeconds: z.number().int().min(0).max(600).optional(),
});

const assignSchema = z.object({
  userId: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXERCISES  (library)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/exercises", authenticate, async (_req, res) => {
  const rows = await db.select().from(exercisesTable).orderBy(desc(exercisesTable.createdAt));
  res.json(rows);
});

router.post("/exercises", authenticate, requireAdmin, async (req, res) => {
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.insert(exercisesTable).values({ name: body.data.name, videoUrl: body.data.videoUrl ?? null, targetMuscle: body.data.targetMuscle }).returning();
  res.status(201).json(row);
});

router.put("/exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.update(exercisesTable).set({ name: body.data.name, videoUrl: body.data.videoUrl ?? null, targetMuscle: body.data.targetMuscle }).where(eq(exercisesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  await db.delete(exercisesTable).where(eq(exercisesTable.id, id));
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/workout-templates", authenticate, async (_req, res) => {
  try {
    const templates = await db
      .select()
      .from(workoutTemplatesTable)
      .orderBy(desc(workoutTemplatesTable.createdAt));

    if (templates.length === 0) {
      res.json([]);
      return;
    }

    // Fan-in instead of fan-out: one query for every template's exercises and
    // one for every template's assignments, then group in memory. The previous
    // version issued 2 queries per template (O(2N)) and was a hot path on the
    // admin dashboard.
    const templateIds = templates.map((t) => t.id);

    const allExercises = await db
      .select({
        templateId: workoutTemplateExercisesTable.templateId,
        id: workoutTemplateExercisesTable.id,
        exerciseId: workoutTemplateExercisesTable.exerciseId,
        sets: workoutTemplateExercisesTable.sets,
        reps: workoutTemplateExercisesTable.reps,
        dayNumber: workoutTemplateExercisesTable.dayNumber,
        sortOrder: workoutTemplateExercisesTable.sortOrder,
        exerciseName: exercisesTable.name,
        targetMuscle: exercisesTable.targetMuscle,
        videoUrl: exercisesTable.videoUrl,
        notes: workoutTemplateExercisesTable.notes,
        restSeconds: workoutTemplateExercisesTable.restSeconds,
      })
      .from(workoutTemplateExercisesTable)
      .innerJoin(exercisesTable, eq(workoutTemplateExercisesTable.exerciseId, exercisesTable.id))
      .where(inArray(workoutTemplateExercisesTable.templateId, templateIds))
      .orderBy(asc(workoutTemplateExercisesTable.dayNumber), asc(workoutTemplateExercisesTable.sortOrder));

    const allAssignments = await db
      .select({
        templateId: memberWorkoutAssignmentsTable.templateId,
        id: memberWorkoutAssignmentsTable.id,
      })
      .from(memberWorkoutAssignmentsTable)
      .where(inArray(memberWorkoutAssignmentsTable.templateId, templateIds));

    const exercisesByTemplate = new Map<number, typeof allExercises>();
    for (const ex of allExercises) {
      const arr = exercisesByTemplate.get(ex.templateId) ?? [];
      arr.push(ex);
      exercisesByTemplate.set(ex.templateId, arr);
    }
    const assignmentCounts = new Map<number, number>();
    for (const a of allAssignments) {
      assignmentCounts.set(a.templateId, (assignmentCounts.get(a.templateId) ?? 0) + 1);
    }

    const result = templates.map((t) => ({
      ...t,
      exercises: exercisesByTemplate.get(t.id) ?? [],
      assignedCount: assignmentCounts.get(t.id) ?? 0,
    }));
    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /workout-templates failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/workout-templates", authenticate, requireAdmin, async (req, res) => {
  const body = templateSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.insert(workoutTemplatesTable).values({ name: body.data.name, daysCount: body.data.daysCount ?? 1, daysPerWeek: body.data.daysPerWeek ?? 4, dayNames: body.data.dayNames ?? null, notes: body.data.notes ?? null }).returning();
  res.status(201).json({ ...row, exercises: [], assignedCount: 0 });
});

router.put("/workout-templates/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = templateSchema.partial().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const updates: WorkoutTemplateUpdate = {};
  if (body.data.name) updates.name = body.data.name;
  if (body.data.daysCount) updates.daysCount = body.data.daysCount;
  if (body.data.daysPerWeek) updates.daysPerWeek = body.data.daysPerWeek;
  if (body.data.dayNames !== undefined) updates.dayNames = body.data.dayNames;
  if (body.data.notes !== undefined) updates.notes = body.data.notes;
  const [row] = await db.update(workoutTemplatesTable).set(updates).where(eq(workoutTemplatesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/workout-templates/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  await db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id));
  res.json({ success: true });
});

// ── Template exercises ──────────────────────────────────────────────────────

router.post("/workout-templates/:templateId/exercises", authenticate, requireAdmin, async (req, res) => {
  const templateId = parseId(req.params.templateId, res, "معرّف القالب");
  if (templateId === null) return;
  const body = templateExerciseSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }

  const maxOrder = await db
    .select({ sortOrder: workoutTemplateExercisesTable.sortOrder })
    .from(workoutTemplateExercisesTable)
    .where(eq(workoutTemplateExercisesTable.templateId, templateId))
    .orderBy(desc(workoutTemplateExercisesTable.sortOrder))
    .limit(1);

  const [row] = await db.insert(workoutTemplateExercisesTable).values({
    templateId,
    exerciseId: body.data.exerciseId,
    sets: body.data.sets,
    reps: body.data.reps,
    dayNumber: body.data.dayNumber ?? 1,
    sortOrder: body.data.sortOrder ?? ((maxOrder[0]?.sortOrder ?? -1) + 1),
    notes: body.data.notes ?? null,
    restSeconds: body.data.restSeconds ?? 90,
  }).returning();

  res.status(201).json(row);
});

router.put("/workout-template-exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = templateExerciseSchema.partial().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.update(workoutTemplateExercisesTable).set(body.data).where(eq(workoutTemplateExercisesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/workout-template-exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  await db.delete(workoutTemplateExercisesTable).where(eq(workoutTemplateExercisesTable.id, id));
  res.json({ success: true });
});

// ── Duplicate template ──────────────────────────────────────────────────────

router.post("/workout-templates/:id/duplicate", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [orig] = await db.select().from(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id)).limit(1);
  if (!orig) { res.status(404).json({ error: "Not found" }); return; }

  const [newTemplate] = await db.insert(workoutTemplatesTable).values({
    name: orig.name + " (نسخة)",
    daysCount: orig.daysCount,
    daysPerWeek: orig.daysPerWeek,
    dayNames: orig.dayNames,
    notes: orig.notes,
  }).returning();

  const origExercises = await db.select().from(workoutTemplateExercisesTable)
    .where(eq(workoutTemplateExercisesTable.templateId, id))
    .orderBy(asc(workoutTemplateExercisesTable.dayNumber), asc(workoutTemplateExercisesTable.sortOrder));

  for (const ex of origExercises) {
    await db.insert(workoutTemplateExercisesTable).values({
      templateId: newTemplate.id,
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      dayNumber: ex.dayNumber,
      sortOrder: ex.sortOrder,
      notes: ex.notes,
      restSeconds: ex.restSeconds,
    });
  }

  res.status(201).json({ ...newTemplate, exercises: origExercises.length, message: "تم نسخ القالب" });
});

// ── Member assignments ──────────────────────────────────────────────────────

router.get("/workout-templates/:templateId/assignments", authenticate, requireAdmin, async (req, res) => {
  const templateId = parseId(req.params.templateId, res, "معرّف القالب");
  if (templateId === null) return;
  const rows = await db.select().from(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.templateId, templateId));
  res.json(rows);
});

router.post("/workout-templates/:templateId/assign", authenticate, requireAdmin, async (req, res) => {
  const templateId = parseId(req.params.templateId, res, "معرّف القالب");
  if (templateId === null) return;
  const body = assignSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const userId = parseUserId(body.data.userId, res);
  if (userId === null) return;
  const [row] = await db.insert(memberWorkoutAssignmentsTable).values({ templateId, userId }).returning();
  res.status(201).json(row);
});

router.delete("/workout-assignments/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  await db.delete(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.id, id));
  res.json({ success: true });
});

// ── Member: my assigned templates ───────────────────────────────────────────

router.get("/my-workouts", authenticate, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const assignments = await db
      .select()
      .from(memberWorkoutAssignmentsTable)
      .where(eq(memberWorkoutAssignmentsTable.userId, userId));

    if (assignments.length === 0) {
      res.json([]);
      return;
    }

    const templateIds = assignments.map((a) => a.templateId);
    const templates = await db
      .select()
      .from(workoutTemplatesTable)
      .where(inArray(workoutTemplatesTable.id, templateIds));

    const allExercises = await db
      .select({
        templateId: workoutTemplateExercisesTable.templateId,
        id: workoutTemplateExercisesTable.id,
        exerciseId: workoutTemplateExercisesTable.exerciseId,
        sets: workoutTemplateExercisesTable.sets,
        reps: workoutTemplateExercisesTable.reps,
        dayNumber: workoutTemplateExercisesTable.dayNumber,
        sortOrder: workoutTemplateExercisesTable.sortOrder,
        exerciseName: exercisesTable.name,
        targetMuscle: exercisesTable.targetMuscle,
        videoUrl: exercisesTable.videoUrl,
        notes: workoutTemplateExercisesTable.notes,
        restSeconds: workoutTemplateExercisesTable.restSeconds,
      })
      .from(workoutTemplateExercisesTable)
      .innerJoin(exercisesTable, eq(workoutTemplateExercisesTable.exerciseId, exercisesTable.id))
      .where(inArray(workoutTemplateExercisesTable.templateId, templateIds))
      .orderBy(asc(workoutTemplateExercisesTable.dayNumber), asc(workoutTemplateExercisesTable.sortOrder));

    const exercisesByTemplate = new Map<number, typeof allExercises>();
    for (const ex of allExercises) {
      const arr = exercisesByTemplate.get(ex.templateId) ?? [];
      arr.push(ex);
      exercisesByTemplate.set(ex.templateId, arr);
    }
    const templatesById = new Map(templates.map((t) => [t.id, t]));

    const result = assignments
      .map((a) => {
        const template = templatesById.get(a.templateId);
        if (!template) return null;
        return {
          ...template,
          assignedAt: a.assignedAt,
          exercises: exercisesByTemplate.get(a.templateId) ?? [],
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    logger.error({ err, userId }, "GET /my-workouts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
