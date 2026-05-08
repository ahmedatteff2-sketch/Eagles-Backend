import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Convert "HH:MM" to a minute count so range checks don't have to think about
// strings.
function minutesOf(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

const scheduleBase = z.object({
  dayOfWeek: z.enum(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]),
  startTime: z.string().regex(TIME_RE, "وقت البدء غير صالح"),
  endTime: z.string().regex(TIME_RE, "وقت الانتهاء غير صالح"),
  className: z.string().min(1).max(100),
  trainerName: z.string().max(100).optional(),
  capacity: z.number().int().positive().max(1000).optional(),
  location: z.string().max(100).optional(),
});

const scheduleSchema = scheduleBase.refine(
  (d) => minutesOf(d.startTime) < minutesOf(d.endTime),
  { message: "وقت البدء يجب أن يكون قبل وقت الانتهاء", path: ["endTime"] },
);

// For partial updates we only validate the time range when both ends are
// present in the payload — a request that only updates startTime can't be
// checked against the existing endTime without an extra DB roundtrip, and
// the full schema is enforced on creation.
const partialScheduleSchema = scheduleBase.partial().refine(
  (d) => !(d.startTime && d.endTime) || minutesOf(d.startTime) < minutesOf(d.endTime),
  { message: "وقت البدء يجب أن يكون قبل وقت الانتهاء", path: ["endTime"] },
);

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

  const body = partialScheduleSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Validation error",
      message: body.error.issues[0]?.message ?? "بيانات غير صالحة",
    });
    return;
  }
  try {
    const [entry] = await db.update(scheduleTable).set(body.data).where(eq(scheduleTable.id, scheduleId)).returning();
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(entry);
  } catch (err) {
    logger.error({ err, scheduleId }, "PUT /schedule failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تحديث الحصة" });
  }
});

router.delete("/schedule/:scheduleId", authenticate, requireAdmin, async (req, res) => {
  const scheduleId = parseId(req.params.scheduleId, res, "معرّف الحصة");
  if (!scheduleId) return;

  try {
    await db.delete(scheduleTable).where(eq(scheduleTable.id, scheduleId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, scheduleId }, "DELETE /schedule failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء حذف الحصة" });
  }
});

export default router;
