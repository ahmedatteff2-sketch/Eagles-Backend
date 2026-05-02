import { Router } from "express";
import { db } from "@workspace/db";
import { trainingProgramsTable, trainingWeeksTable, exercisesTable } from "@workspace/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const programSchema = z.object({
  name: z.string().min(1),
  userId: z.number().int(),
});

const weekSchema = z.object({
  weekNumber: z.number().int().min(1).max(12),
});

const exerciseSchema = z.object({
  name: z.string().min(1),
  videoUrl: z.string().nullable().optional(),
  setsRequired: z.number().int().min(1).max(10),
  repsMin: z.number().int().positive(),
  repsMax: z.number().int().positive(),
});

// ─── TRAINING TEMPLATES ───────────────────────────────────────────────────────

type ExTemplate = { name: string; setsRequired: number; repsMin: number; repsMax: number; videoUrl?: string };
type WeekTemplate = { weekLabel: string; exercises: ExTemplate[] };
type ProgramTemplate = {
  id: string;
  name: string;
  description: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: WeekTemplate[];
};

const TEMPLATES: ProgramTemplate[] = [
  {
    id: "beginner_fullbody",
    name: "برنامج مبتدئ - تمرين كامل",
    description: "مناسب للمبتدئين، تمرين لكامل الجسم 3 أيام في الأسبوع",
    goal: "بناء اللياقة الأساسية",
    level: "مبتدئ",
    daysPerWeek: 3,
    weeks: [
      {
        weekLabel: "الأسبوع 1 - البداية",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "بنش بريس بالبار", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "لات بول داون", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "بلانك", setsRequired: 3, repsMin: 30, repsMax: 45 },
        ],
      },
      {
        weekLabel: "الأسبوع 2 - تطوير",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "بنش بريس بالبار", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "لات بول داون", setsRequired: 3, repsMin: 10, repsMax: 15 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "كرنشز", setsRequired: 3, repsMin: 15, repsMax: 20 },
        ],
      },
      {
        weekLabel: "الأسبوع 3 - زيادة الحجم",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "ديدليفت", setsRequired: 3, repsMin: 6, repsMax: 8 },
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "باربيل رو", setsRequired: 4, repsMin: 8, repsMax: 10 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "بلانك", setsRequired: 3, repsMin: 45, repsMax: 60 },
        ],
      },
      {
        weekLabel: "الأسبوع 4 - ذروة الشدة",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 10, repsMax: 15 },
          { name: "ديدليفت", setsRequired: 4, repsMin: 6, repsMax: 8 },
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "باربيل رو", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "أوفر هيد بريس", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "لات بول داون", setsRequired: 3, repsMin: 10, repsMax: 15 },
        ],
      },
    ],
  },
  {
    id: "hypertrophy_ppl",
    name: "برنامج تضخيم - Push Pull Legs",
    description: "برنامج تضخيم متوسط مقسم على صدر/ظهر/أرجل — 6 أيام",
    goal: "زيادة الكتلة العضلية",
    level: "متوسط",
    daysPerWeek: 6,
    weeks: [
      {
        weekLabel: "الأسبوع 1 - يوم الدفع (Push)",
        exercises: [
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "انكلاين دمبل بريس", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "أوفر هيد بريس", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "لاترال ريز", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ترايسبس بوش داون", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "سكول كراشر", setsRequired: 3, repsMin: 10, repsMax: 12 },
        ],
      },
      {
        weekLabel: "الأسبوع 2 - يوم السحب (Pull)",
        exercises: [
          { name: "ديدليفت", setsRequired: 4, repsMin: 5, repsMax: 8 },
          { name: "باربيل رو", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "لات بول داون", setsRequired: 4, repsMin: 10, repsMax: 12 },
          { name: "سيتد كابل رو", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "باربيل كيرل", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "هامر كيرل", setsRequired: 3, repsMin: 12, repsMax: 15 },
        ],
      },
      {
        weekLabel: "الأسبوع 3 - يوم الأرجل (Legs)",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 8, repsMax: 12 },
          { name: "ليج بريس", setsRequired: 4, repsMin: 10, repsMax: 15 },
          { name: "لانجز بالدمبل", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ليج كيرل", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ليج إكستنشن", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ستاندينج كالف ريز", setsRequired: 4, repsMin: 15, repsMax: 20 },
        ],
      },
      {
        weekLabel: "الأسبوع 4 - Full Body (إزالة التعب)",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 3, repsMin: 8, repsMax: 10 },
          { name: "بنش بريس بالبار", setsRequired: 3, repsMin: 8, repsMax: 10 },
          { name: "ديدليفت", setsRequired: 3, repsMin: 5, repsMax: 6 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 8, repsMax: 10 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 8, repsMax: 10 },
        ],
      },
    ],
  },
  {
    id: "fat_loss",
    name: "برنامج حرق الدهون",
    description: "تمارين مركبة عالية التكرار + كارديو — 4 أيام في الأسبوع",
    goal: "حرق الدهون والتنحيف",
    level: "متوسط",
    daysPerWeek: 4,
    weeks: [
      {
        weekLabel: "الأسبوع 1 - تفعيل الحرق",
        exercises: [
          { name: "سكوات بوزن الجسم", setsRequired: 3, repsMin: 15, repsMax: 20 },
          { name: "بوش أب", setsRequired: 3, repsMin: 12, repsMax: 20 },
          { name: "لانجز", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "بول أب أو لات بول داون", setsRequired: 3, repsMin: 8, repsMax: 12 },
          { name: "بلانك", setsRequired: 3, repsMin: 30, repsMax: 60 },
          { name: "جامبينج جاكس (ثانية)", setsRequired: 3, repsMin: 30, repsMax: 45 },
        ],
      },
      {
        weekLabel: "الأسبوع 2 - رفع الشدة",
        exercises: [
          { name: "جوبليت سكوات", setsRequired: 4, repsMin: 15, repsMax: 20 },
          { name: "انكلاين بنش بريس", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ديدليفت رومانياني", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "ماونتن كلايمبر (ثانية)", setsRequired: 3, repsMin: 30, repsMax: 45 },
          { name: "بيرببيز", setsRequired: 3, repsMin: 10, repsMax: 15 },
        ],
      },
      {
        weekLabel: "الأسبوع 3 - سيركت",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 12, repsMax: 15 },
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 12, repsMax: 15 },
          { name: "ديدليفت", setsRequired: 3, repsMin: 10, repsMax: 12 },
          { name: "لانجز بالدمبل", setsRequired: 3, repsMin: 12, repsMax: 15 },
          { name: "كرنشز", setsRequired: 3, repsMin: 20, repsMax: 25 },
          { name: "هاي نيز (ثانية)", setsRequired: 3, repsMin: 30, repsMax: 45 },
        ],
      },
      {
        weekLabel: "الأسبوع 4 - ذروة الحرق",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 15, repsMax: 20 },
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 12, repsMax: 15 },
          { name: "ديدليفت", setsRequired: 4, repsMin: 10, repsMax: 12 },
          { name: "باربيل رو", setsRequired: 4, repsMin: 12, repsMax: 15 },
          { name: "بيرببيز", setsRequired: 3, repsMin: 15, repsMax: 20 },
          { name: "بلانك", setsRequired: 3, repsMin: 60, repsMax: 90 },
        ],
      },
    ],
  },
  {
    id: "strength",
    name: "برنامج القوة - الثلاثة الكبار",
    description: "تركيز على السكوات، البنش، والديدليفت لبناء أقصى قوة — 4 أيام",
    goal: "زيادة القوة القصوى",
    level: "متقدم",
    daysPerWeek: 4,
    weeks: [
      {
        weekLabel: "الأسبوع 1 - حجم كبير",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 5, repsMin: 5, repsMax: 5 },
          { name: "بنش بريس بالبار", setsRequired: 5, repsMin: 5, repsMax: 5 },
          { name: "ديدليفت", setsRequired: 5, repsMin: 5, repsMax: 5 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 5, repsMax: 8 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 5, repsMax: 8 },
        ],
      },
      {
        weekLabel: "الأسبوع 2 - شدة",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 4, repsMin: 3, repsMax: 5 },
          { name: "بنش بريس بالبار", setsRequired: 4, repsMin: 3, repsMax: 5 },
          { name: "ديدليفت", setsRequired: 4, repsMin: 3, repsMax: 5 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 5, repsMax: 6 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 5, repsMax: 6 },
        ],
      },
      {
        weekLabel: "الأسبوع 3 - ذروة الشدة",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 3, repsMin: 2, repsMax: 3 },
          { name: "بنش بريس بالبار", setsRequired: 3, repsMin: 2, repsMax: 3 },
          { name: "ديدليفت", setsRequired: 3, repsMin: 2, repsMax: 3 },
          { name: "أوفر هيد بريس", setsRequired: 3, repsMin: 3, repsMax: 5 },
          { name: "باربيل رو", setsRequired: 3, repsMin: 3, repsMax: 5 },
        ],
      },
      {
        weekLabel: "الأسبوع 4 - تخفيف (Deload)",
        exercises: [
          { name: "سكوات بالبار", setsRequired: 2, repsMin: 5, repsMax: 5 },
          { name: "بنش بريس بالبار", setsRequired: 2, repsMin: 5, repsMax: 5 },
          { name: "ديدليفت", setsRequired: 2, repsMin: 5, repsMax: 5 },
          { name: "أوفر هيد بريس", setsRequired: 2, repsMin: 5, repsMax: 8 },
          { name: "باربيل رو", setsRequired: 2, repsMin: 5, repsMax: 8 },
        ],
      },
    ],
  },
];

// ─── ROUTES ───────────────────────────────────────────────────────────────────

router.get("/training-templates", authenticate, requireAdmin, async (_req, res) => {
  const summary = TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    goal: t.goal,
    level: t.level,
    daysPerWeek: t.daysPerWeek,
    weekCount: t.weeks.length,
    totalExercises: t.weeks.reduce((a, w) => a + w.exercises.length, 0),
    weekLabels: t.weeks.map(w => w.weekLabel),
  }));
  res.json(summary);
});

router.post("/training-programs/:programId/apply-template", authenticate, requireAdmin, async (req, res) => {
  const programId = Number(req.params.programId);
  const { templateId } = req.body as { templateId: string };

  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    res.status(404).json({ error: "القالب غير موجود" });
    return;
  }

  const [prog] = await db.select().from(trainingProgramsTable).where(eq(trainingProgramsTable.id, programId)).limit(1);
  if (!prog) {
    res.status(404).json({ error: "البرنامج غير موجود" });
    return;
  }

  // Delete existing weeks + exercises
  const existingWeeks = await db.select().from(trainingWeeksTable).where(eq(trainingWeeksTable.programId, programId));
  for (const w of existingWeeks) {
    await db.delete(exercisesTable).where(eq(exercisesTable.weekId, w.id));
  }
  await db.delete(trainingWeeksTable).where(eq(trainingWeeksTable.programId, programId));

  // Create new weeks + exercises
  let created = 0;
  for (let i = 0; i < template.weeks.length; i++) {
    const weekData = template.weeks[i];
    const [week] = await db.insert(trainingWeeksTable).values({ programId, weekNumber: i + 1 }).returning();
    for (const ex of weekData.exercises) {
      await db.insert(exercisesTable).values({
        weekId: week.id,
        name: ex.name,
        setsRequired: ex.setsRequired,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        videoUrl: ex.videoUrl ?? null,
      });
      created++;
    }
  }

  res.json({
    success: true,
    message: `تم تطبيق القالب: ${template.weeks.length} أسابيع، ${created} تمرين`,
    weekCount: template.weeks.length,
    exerciseCount: created,
  });
});

router.get("/training-programs", authenticate, async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const effectiveUserId = req.user!.role === "admin" ? userId : req.user!.userId;

  let programs;
  if (effectiveUserId) {
    programs = await db.select().from(trainingProgramsTable).where(eq(trainingProgramsTable.userId, effectiveUserId)).orderBy(desc(trainingProgramsTable.createdAt));
  } else {
    programs = await db.select().from(trainingProgramsTable).orderBy(desc(trainingProgramsTable.createdAt));
  }

  const withWeekCount = await Promise.all(
    programs.map(async (p) => {
      const [row] = await db.select({ count: count() }).from(trainingWeeksTable).where(eq(trainingWeeksTable.programId, p.id));
      return { ...p, weekCount: row?.count ?? 0 };
    })
  );

  res.json(withWeekCount);
});

router.post("/training-programs", authenticate, requireAdmin, async (req, res) => {
  const body = programSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [prog] = await db.insert(trainingProgramsTable).values(body.data).returning();
  res.status(201).json({ ...prog, weekCount: 0 });
});

router.get("/training-programs/:programId", authenticate, async (req, res) => {
  const programId = Number(req.params.programId);
  const [prog] = await db.select().from(trainingProgramsTable).where(eq(trainingProgramsTable.id, programId)).limit(1);
  if (!prog) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.user!.role !== "admin" && req.user!.userId !== prog.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const weeks = await db.select().from(trainingWeeksTable).where(eq(trainingWeeksTable.programId, programId)).orderBy(trainingWeeksTable.weekNumber);
  const weeksWithExercises = await Promise.all(
    weeks.map(async (w) => {
      const exercises = await db.select().from(exercisesTable).where(eq(exercisesTable.weekId, w.id));
      return { ...w, exercises };
    })
  );
  res.json({ ...prog, weeks: weeksWithExercises });
});

router.delete("/training-programs/:programId", authenticate, requireAdmin, async (req, res) => {
  const programId = Number(req.params.programId);
  const weeks = await db.select().from(trainingWeeksTable).where(eq(trainingWeeksTable.programId, programId));
  for (const w of weeks) {
    await db.delete(exercisesTable).where(eq(exercisesTable.weekId, w.id));
  }
  await db.delete(trainingWeeksTable).where(eq(trainingWeeksTable.programId, programId));
  await db.delete(trainingProgramsTable).where(eq(trainingProgramsTable.id, programId));
  res.json({ success: true, message: "تم حذف البرنامج" });
});

router.post("/training-programs/:programId/weeks", authenticate, requireAdmin, async (req, res) => {
  const programId = Number(req.params.programId);
  const body = weekSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [week] = await db.insert(trainingWeeksTable).values({ programId, weekNumber: body.data.weekNumber }).returning();
  res.status(201).json(week);
});

router.get("/training-weeks/:weekId/exercises", authenticate, async (req, res) => {
  const weekId = Number(req.params.weekId);
  const exercises = await db.select().from(exercisesTable).where(eq(exercisesTable.weekId, weekId));
  res.json(exercises);
});

router.post("/training-weeks/:weekId/exercises", authenticate, requireAdmin, async (req, res) => {
  const weekId = Number(req.params.weekId);
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [ex] = await db.insert(exercisesTable).values({ ...body.data, weekId, videoUrl: body.data.videoUrl ?? null }).returning();
  res.status(201).json(ex);
});

router.put("/exercises/:exerciseId", authenticate, requireAdmin, async (req, res) => {
  const exerciseId = Number(req.params.exerciseId);
  const body = exerciseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [ex] = await db.update(exercisesTable).set({ ...body.data, videoUrl: body.data.videoUrl ?? null }).where(eq(exercisesTable.id, exerciseId)).returning();
  if (!ex) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(ex);
});

router.delete("/exercises/:exerciseId", authenticate, requireAdmin, async (req, res) => {
  const exerciseId = Number(req.params.exerciseId);
  await db.delete(exercisesTable).where(eq(exercisesTable.id, exerciseId));
  res.json({ success: true, message: "تم حذف التمرين" });
});

export default router;
