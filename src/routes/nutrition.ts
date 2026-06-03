import { Router } from "express";
import { db } from "@workspace/db";
import { foodsTable, foodLogsTable } from "@workspace/db/schema";
import { and, eq, ilike } from "drizzle-orm";
import { authenticate } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

const round1 = (n: number): number => Math.round(n * 10) / 10;

type FoodRow = typeof foodsTable.$inferSelect;
function toFood(f: FoodRow) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    caloriesPer100g: Number(f.caloriesPer100g),
    proteinPer100g: Number(f.proteinPer100g),
    carbsPer100g: Number(f.carbsPer100g),
    fatsPer100g: Number(f.fatsPer100g),
  };
}

type LogRow = typeof foodLogsTable.$inferSelect;
function toLog(r: LogRow) {
  return {
    id: r.id,
    date: r.date,
    foodName: r.foodName,
    grams: Number(r.grams),
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fats: Number(r.fats),
  };
}

// ── Food catalog ────────────────────────────────────────────────────────────
// GET /api/foods?search=  — search the curated per-100g catalog.
router.get("/foods", authenticate, async (req, res) => {
  const raw = typeof req.query.search === "string" ? req.query.search.slice(0, 50) : "";
  // Escape LIKE wildcards so a literal % / _ doesn't act as a wildcard.
  const search = raw.replace(/[%_\\]/g, (c) => `\\${c}`);
  try {
    const rows = await db
      .select()
      .from(foodsTable)
      .where(search ? ilike(foodsTable.name, `%${search}%`) : undefined)
      .orderBy(foodsTable.name)
      .limit(50);
    res.json(rows.map(toFood));
  } catch (err) {
    logger.error({ err }, "GET /foods failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأطعمة" });
  }
});

// ── Food log ──────────────────────────────────────────────────────────────--
const logSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
    grams: z.number().positive().max(5000),
    // Either reference a catalog food …
    foodId: z.number().int().positive().optional(),
    // … or supply a custom food with its own per-100g macros.
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    caloriesPer100g: z.number().min(0).max(1000).optional(),
    proteinPer100g: z.number().min(0).max(200).optional(),
    carbsPer100g: z.number().min(0).max(200).optional(),
    fatsPer100g: z.number().min(0).max(200).optional(),
  })
  .refine(
    (d) =>
      d.foodId !== undefined ||
      (d.name !== undefined &&
        d.caloriesPer100g !== undefined &&
        d.proteinPer100g !== undefined &&
        d.carbsPer100g !== undefined &&
        d.fatsPer100g !== undefined),
    { message: "يجب اختيار صنف من القائمة أو إدخال صنف مخصص بقيمه الغذائية" },
  );

// POST /api/food-logs — log a food; macros are computed on the server from the
// per-100g reference values so the client can never fake the totals.
router.post("/food-logs", authenticate, async (req, res) => {
  const body = logSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const d = body.data;
  try {
    let name: string;
    let c100: number;
    let p100: number;
    let cb100: number;
    let f100: number;

    if (d.foodId !== undefined) {
      const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, d.foodId)).limit(1);
      if (!food) {
        res.status(404).json({ error: "Not found", message: "الصنف غير موجود" });
        return;
      }
      name = food.name;
      c100 = Number(food.caloriesPer100g);
      p100 = Number(food.proteinPer100g);
      cb100 = Number(food.carbsPer100g);
      f100 = Number(food.fatsPer100g);
    } else {
      name = d.name!;
      c100 = d.caloriesPer100g!;
      p100 = d.proteinPer100g!;
      cb100 = d.carbsPer100g!;
      f100 = d.fatsPer100g!;
    }

    const factor = d.grams / 100;
    const [row] = await db
      .insert(foodLogsTable)
      .values({
        userId: req.user!.userId,
        date: d.date,
        foodName: name,
        grams: String(round1(d.grams)),
        calories: String(round1(c100 * factor)),
        protein: String(round1(p100 * factor)),
        carbs: String(round1(cb100 * factor)),
        fats: String(round1(f100 * factor)),
      })
      .returning();
    res.status(201).json(toLog(row));
  } catch (err) {
    logger.error({ err }, "POST /food-logs failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تسجيل الأكل" });
  }
});

// GET /api/food-logs?date=YYYY-MM-DD — the member's entries for a day + totals.
router.get("/food-logs", authenticate, async (req, res) => {
  const raw = typeof req.query.date === "string" ? req.query.date : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  try {
    const rows = await db
      .select()
      .from(foodLogsTable)
      .where(and(eq(foodLogsTable.userId, req.user!.userId), eq(foodLogsTable.date, date)))
      .orderBy(foodLogsTable.createdAt);
    const items = rows.map(toLog);
    const totals = items.reduce(
      (acc, i) => ({
        calories: round1(acc.calories + i.calories),
        protein: round1(acc.protein + i.protein),
        carbs: round1(acc.carbs + i.carbs),
        fats: round1(acc.fats + i.fats),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
    res.json({ date, items, totals });
  } catch (err) {
    logger.error({ err }, "GET /food-logs failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب السجل" });
  }
});

// DELETE /api/food-logs/:id — remove one of the member's own entries.
router.delete("/food-logs/:id", authenticate, async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null) return;
  try {
    // Scoped to the caller's own rows — a foreign id simply matches nothing.
    await db
      .delete(foodLogsTable)
      .where(and(eq(foodLogsTable.id, id), eq(foodLogsTable.userId, req.user!.userId)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "DELETE /food-logs/:id failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

export default router;
