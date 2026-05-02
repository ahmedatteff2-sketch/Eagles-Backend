import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { z } from "zod";

const router = Router();

const scheduleSchema = z.object({
  dayOfWeek: z.enum(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  className: z.string().min(1).max(100),
  trainerName: z.string().max(100).optional(),
  capacity: z.number().int().positive().max(1000).optional(),
  location: z.string().max(100).optional(),
});

const DAY_ORDER: Record<string, number> = {
  saturday: 0, sunday: 1, monday: 2, tuesday: 3,
  wednesday: 4, thursday: 5, friday: 6,
};

router.get("/schedule", authenticate, async (req, res) => {
  try {
    const rows = await db.select().from(scheduleTable);
    const sorted = rows.sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.dayOfWeek] ?? 0) - (DAY_ORDER[b.dayOfWeek] ?? 0);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
    res.json(sorted);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الجدول" });
  }
});

router.post("/schedule", authenticate, requireAdmin, async (req, res) => {
  const body = scheduleSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [entry] = await db.insert(scheduleTable).values(body.data).returning();
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة الحصة" });
  }
});

router.put("/schedule/:scheduleId", authenticate, requireAdmin, async (req, res) => {
  const scheduleId = parseId(req.params.scheduleId, res, "معرّف الحصة");
  if (!scheduleId) return;

  const body = scheduleSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [entry] = await db.update(scheduleTable).set(body.data).where(eq(scheduleTable.id, scheduleId)).returning();
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(entry);
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تحديث الحصة" });
  }
});

router.delete("/schedule/:scheduleId", authenticate, requireAdmin, async (req, res) => {
  const scheduleId = parseId(req.params.scheduleId, res, "معرّف الحصة");
  if (!scheduleId) return;

  try {
    await db.delete(scheduleTable).where(eq(scheduleTable.id, scheduleId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء حذف الحصة" });
  }
});

export default router;
