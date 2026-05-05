import { Router } from "express";
import { db } from "@workspace/db";
import {
  exercisesTable,
  workoutTemplatesTable,
  workoutTemplateExercisesTable,
  memberWorkoutAssignmentsTable,
} from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const exerciseSchema = z.object({
  name: z.string().min(1),
  videoUrl: z.string().nullable().optional(),
  targetMuscle: z.string().min(1),
});

const templateSchema = z.object({
  name: z.string().min(1),
});

const templateExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
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
  const id = Number(req.params.id);
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.update(exercisesTable).set({ name: body.data.name, videoUrl: body.data.videoUrl ?? null, targetMuscle: body.data.targetMuscle }).where(eq(exercisesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(exercisesTable).where(eq(exercisesTable.id, id));
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/workout-templates", authenticate, async (_req, res) => {
  const templates = await db.select().from(workoutTemplatesTable).orderBy(desc(workoutTemplatesTable.createdAt));

  const result = await Promise.all(templates.map(async (t) => {
    const exercises = await db
      .select({
        id: workoutTemplateExercisesTable.id,
        exerciseId: workoutTemplateExercisesTable.exerciseId,
        sets: workoutTemplateExercisesTable.sets,
        reps: workoutTemplateExercisesTable.reps,
        sortOrder: workoutTemplateExercisesTable.sortOrder,
        exerciseName: exercisesTable.name,
        targetMuscle: exercisesTable.targetMuscle,
        videoUrl: exercisesTable.videoUrl,
      })
      .from(workoutTemplateExercisesTable)
      .innerJoin(exercisesTable, eq(workoutTemplateExercisesTable.exerciseId, exercisesTable.id))
      .where(eq(workoutTemplateExercisesTable.templateId, t.id))
      .orderBy(asc(workoutTemplateExercisesTable.sortOrder));

    const assignments = await db
      .select()
      .from(memberWorkoutAssignmentsTable)
      .where(eq(memberWorkoutAssignmentsTable.templateId, t.id));

    return { ...t, exercises, assignedCount: assignments.length };
  }));

  res.json(result);
});

router.post("/workout-templates", authenticate, requireAdmin, async (req, res) => {
  const body = templateSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.insert(workoutTemplatesTable).values(body.data).returning();
  res.status(201).json({ ...row, exercises: [], assignedCount: 0 });
});

router.delete("/workout-templates/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id));
  res.json({ success: true });
});

// ── Template exercises ──────────────────────────────────────────────────────

router.post("/workout-templates/:templateId/exercises", authenticate, requireAdmin, async (req, res) => {
  const templateId = Number(req.params.templateId);
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
    sortOrder: body.data.sortOrder ?? ((maxOrder[0]?.sortOrder ?? -1) + 1),
  }).returning();

  res.status(201).json(row);
});

router.put("/workout-template-exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = templateExerciseSchema.partial().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.update(workoutTemplateExercisesTable).set(body.data).where(eq(workoutTemplateExercisesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/workout-template-exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(workoutTemplateExercisesTable).where(eq(workoutTemplateExercisesTable.id, id));
  res.json({ success: true });
});

// ── Member assignments ──────────────────────────────────────────────────────

router.get("/workout-templates/:templateId/assignments", authenticate, requireAdmin, async (req, res) => {
  const templateId = Number(req.params.templateId);
  const rows = await db.select().from(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.templateId, templateId));
  res.json(rows);
});

router.post("/workout-templates/:templateId/assign", authenticate, requireAdmin, async (req, res) => {
  const templateId = Number(req.params.templateId);
  const body = assignSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [row] = await db.insert(memberWorkoutAssignmentsTable).values({ templateId, userId: body.data.userId }).returning();
  res.status(201).json(row);
});

router.delete("/workout-assignments/:id", authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.id, id));
  res.json({ success: true });
});

// ── Member: my assigned templates ───────────────────────────────────────────

router.get("/my-workouts", authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const assignments = await db.select().from(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.userId, userId));

  const result = await Promise.all(assignments.map(async (a) => {
    const [template] = await db.select().from(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, a.templateId)).limit(1);
    if (!template) return null;

    const exercises = await db
      .select({
        id: workoutTemplateExercisesTable.id,
        exerciseId: workoutTemplateExercisesTable.exerciseId,
        sets: workoutTemplateExercisesTable.sets,
        reps: workoutTemplateExercisesTable.reps,
        sortOrder: workoutTemplateExercisesTable.sortOrder,
        exerciseName: exercisesTable.name,
        targetMuscle: exercisesTable.targetMuscle,
        videoUrl: exercisesTable.videoUrl,
      })
      .from(workoutTemplateExercisesTable)
      .innerJoin(exercisesTable, eq(workoutTemplateExercisesTable.exerciseId, exercisesTable.id))
      .where(eq(workoutTemplateExercisesTable.templateId, a.templateId))
      .orderBy(asc(workoutTemplateExercisesTable.sortOrder));

    return { ...template, assignedAt: a.assignedAt, exercises };
  }));

  res.json(result.filter(Boolean));
});

export default router;
