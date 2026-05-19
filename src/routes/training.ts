import { Router } from "express";
import { db } from "@workspace/db";
import {
  exercisesTable,
  workoutTemplatesTable,
  workoutTemplateExercisesTable,
  memberWorkoutAssignmentsTable,
} from "@workspace/db/schema";
import { eq, desc, asc, inArray, isNull } from "drizzle-orm";
import type { Response } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId, parseUserId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

/**
 * Resolve a template and check the current user can mutate it. Admins can
 * mutate anything. Non-admins can only mutate templates they own
 * (`created_by_user_id === their userId`). Returns the template row on
 * success; on failure, writes the response (404/403) and returns null so
 * callers can early-return without ceremony.
 */
async function loadTemplateForWrite(
  templateId: number,
  userId: string,
  role: string,
  res: Response,
): Promise<typeof workoutTemplatesTable.$inferSelect | null> {
  const [tpl] = await db
    .select()
    .from(workoutTemplatesTable)
    .where(eq(workoutTemplatesTable.id, templateId))
    .limit(1);
  if (!tpl) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (role !== "admin" && tpl.createdByUserId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "غير مسموح بتعديل هذا القالب" });
    return null;
  }
  return tpl;
}

async function loadTemplateExerciseForWrite(
  exerciseRowId: number,
  userId: string,
  role: string,
  res: Response,
): Promise<typeof workoutTemplateExercisesTable.$inferSelect | null> {
  const [ex] = await db
    .select()
    .from(workoutTemplateExercisesTable)
    .where(eq(workoutTemplateExercisesTable.id, exerciseRowId))
    .limit(1);
  if (!ex) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  const tpl = await loadTemplateForWrite(ex.templateId, userId, role, res);
  if (!tpl) return null;
  return ex;
}

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
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [row] = await db
    .insert(exercisesTable)
    .values({
      name: body.data.name,
      videoUrl: body.data.videoUrl ?? null,
      targetMuscle: body.data.targetMuscle,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/exercises/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [row] = await db
    .update(exercisesTable)
    .set({ name: body.data.name, videoUrl: body.data.videoUrl ?? null, targetMuscle: body.data.targetMuscle })
    .where(eq(exercisesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
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
    // Admin library only — personal templates owned by members live under
    // GET /api/my-workouts and never show up here. Avoids the admin Templates
    // page silently filling with everyone's personal workouts.
    const templates = await db
      .select()
      .from(workoutTemplatesTable)
      .where(isNull(workoutTemplatesTable.createdByUserId))
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

router.post("/workout-templates", authenticate, async (req, res) => {
  const body = templateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  // Admins create global templates (createdByUserId = NULL); anyone else
  // creates a personal template owned by themselves. Members also get an
  // auto-assignment so the template shows up immediately under
  // GET /api/my-workouts without a separate "assign to self" step.
  const isAdmin = req.user!.role === "admin";
  const ownerId = isAdmin ? null : req.user!.userId;
  const [row] = await db
    .insert(workoutTemplatesTable)
    .values({
      name: body.data.name,
      daysCount: body.data.daysCount ?? 1,
      daysPerWeek: body.data.daysPerWeek ?? 4,
      dayNames: body.data.dayNames ?? null,
      notes: body.data.notes ?? null,
      createdByUserId: ownerId,
    })
    .returning();
  if (ownerId) {
    // Self-assignment is best-effort — the row already shows up via
    // `createdByUserId` in /api/my-workouts, but keeping a matching row in
    // memberWorkoutAssignments preserves the existing client shape and means
    // future "is this template assigned to me?" checks keep working.
    await db
      .insert(memberWorkoutAssignmentsTable)
      .values({ templateId: row.id, userId: ownerId })
      .catch((err) => {
        logger.warn({ err, templateId: row.id, ownerId }, "self-assign after template create failed");
      });
  }
  res.status(201).json({ ...row, exercises: [], assignedCount: ownerId ? 1 : 0, isOwn: !!ownerId });
});

router.put("/workout-templates/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = templateSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const tpl = await loadTemplateForWrite(id, req.user!.userId, req.user!.role, res);
  if (!tpl) return;
  const updates: WorkoutTemplateUpdate = {};
  if (body.data.name) updates.name = body.data.name;
  if (body.data.daysCount) updates.daysCount = body.data.daysCount;
  if (body.data.daysPerWeek) updates.daysPerWeek = body.data.daysPerWeek;
  if (body.data.dayNames !== undefined) updates.dayNames = body.data.dayNames;
  if (body.data.notes !== undefined) updates.notes = body.data.notes;
  const [row] = await db
    .update(workoutTemplatesTable)
    .set(updates)
    .where(eq(workoutTemplatesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/workout-templates/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const tpl = await loadTemplateForWrite(id, req.user!.userId, req.user!.role, res);
  if (!tpl) return;
  await db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id));
  res.json({ success: true });
});

// ── Template exercises ──────────────────────────────────────────────────────

router.post("/workout-templates/:templateId/exercises", authenticate, async (req, res) => {
  const templateId = parseId(req.params.templateId, res, "معرّف القالب");
  if (templateId === null) return;
  const body = templateExerciseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const tpl = await loadTemplateForWrite(templateId, req.user!.userId, req.user!.role, res);
  if (!tpl) return;

  const maxOrder = await db
    .select({ sortOrder: workoutTemplateExercisesTable.sortOrder })
    .from(workoutTemplateExercisesTable)
    .where(eq(workoutTemplateExercisesTable.templateId, templateId))
    .orderBy(desc(workoutTemplateExercisesTable.sortOrder))
    .limit(1);

  const [row] = await db
    .insert(workoutTemplateExercisesTable)
    .values({
      templateId,
      exerciseId: body.data.exerciseId,
      sets: body.data.sets,
      reps: body.data.reps,
      dayNumber: body.data.dayNumber ?? 1,
      sortOrder: body.data.sortOrder ?? (maxOrder[0]?.sortOrder ?? -1) + 1,
      notes: body.data.notes ?? null,
      restSeconds: body.data.restSeconds ?? 90,
    })
    .returning();

  res.status(201).json(row);
});

router.put("/workout-template-exercises/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const body = templateExerciseSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const ex = await loadTemplateExerciseForWrite(id, req.user!.userId, req.user!.role, res);
  if (!ex) return;
  const [row] = await db
    .update(workoutTemplateExercisesTable)
    .set(body.data)
    .where(eq(workoutTemplateExercisesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/workout-template-exercises/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const ex = await loadTemplateExerciseForWrite(id, req.user!.userId, req.user!.role, res);
  if (!ex) return;
  await db.delete(workoutTemplateExercisesTable).where(eq(workoutTemplateExercisesTable.id, id));
  res.json({ success: true });
});

// ── Duplicate template ──────────────────────────────────────────────────────

router.post("/workout-templates/:id/duplicate", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const [orig] = await db
    .select()
    .from(workoutTemplatesTable)
    .where(eq(workoutTemplatesTable.id, id))
    .limit(1);
  if (!orig) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [newTemplate] = await db
    .insert(workoutTemplatesTable)
    .values({
      name: orig.name + " (نسخة)",
      daysCount: orig.daysCount,
      daysPerWeek: orig.daysPerWeek,
      dayNames: orig.dayNames,
      notes: orig.notes,
    })
    .returning();

  const origExercises = await db
    .select()
    .from(workoutTemplateExercisesTable)
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
  const rows = await db
    .select()
    .from(memberWorkoutAssignmentsTable)
    .where(eq(memberWorkoutAssignmentsTable.templateId, templateId));
  res.json(rows);
});

router.post("/workout-templates/:templateId/assign", authenticate, requireAdmin, async (req, res) => {
  const templateId = parseId(req.params.templateId, res, "معرّف القالب");
  if (templateId === null) return;
  const body = assignSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
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
    // Two sources show up here:
    //   1. Templates the admin assigned to this user (memberWorkoutAssignments)
    //   2. Personal templates this user owns (createdByUserId = userId)
    // We union the two sets of template IDs, then load each template's
    // exercises in a single query. Assignment timestamps are stitched back in
    // for templates from source 1; personal templates use the template's own
    // createdAt as the "assignedAt" so the shape stays the same on the wire.
    const [assignments, ownedTemplates] = await Promise.all([
      db.select().from(memberWorkoutAssignmentsTable).where(eq(memberWorkoutAssignmentsTable.userId, userId)),
      db.select().from(workoutTemplatesTable).where(eq(workoutTemplatesTable.createdByUserId, userId)),
    ]);

    const assignedIds = new Set(assignments.map((a) => a.templateId));
    const ownedIds = new Set(ownedTemplates.map((t) => t.id));
    const allTemplateIds = Array.from(new Set([...assignedIds, ...ownedIds]));

    if (allTemplateIds.length === 0) {
      res.json([]);
      return;
    }

    // Fetch missing template rows (assigned templates not in the owned set).
    const missingIds = Array.from(assignedIds).filter((id) => !ownedIds.has(id));
    const assignedTemplates =
      missingIds.length > 0
        ? await db.select().from(workoutTemplatesTable).where(inArray(workoutTemplatesTable.id, missingIds))
        : [];
    const templatesById = new Map<number, typeof workoutTemplatesTable.$inferSelect>();
    for (const t of ownedTemplates) templatesById.set(t.id, t);
    for (const t of assignedTemplates) templatesById.set(t.id, t);

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
      .where(inArray(workoutTemplateExercisesTable.templateId, allTemplateIds))
      .orderBy(asc(workoutTemplateExercisesTable.dayNumber), asc(workoutTemplateExercisesTable.sortOrder));

    const exercisesByTemplate = new Map<number, typeof allExercises>();
    for (const ex of allExercises) {
      const arr = exercisesByTemplate.get(ex.templateId) ?? [];
      arr.push(ex);
      exercisesByTemplate.set(ex.templateId, arr);
    }

    const assignedAtByTemplate = new Map(assignments.map((a) => [a.templateId, a.assignedAt]));

    const result = allTemplateIds
      .map((id) => {
        const template = templatesById.get(id);
        if (!template) return null;
        const isOwned = ownedIds.has(id);
        return {
          ...template,
          // Surface ownership so the UI can decide whether to show
          // edit/delete controls without re-querying.
          isOwn: isOwned,
          assignedAt: assignedAtByTemplate.get(id) ?? template.createdAt,
          exercises: exercisesByTemplate.get(id) ?? [],
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
