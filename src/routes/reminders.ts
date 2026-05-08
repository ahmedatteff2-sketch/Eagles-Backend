import { Router } from "express";
import { db } from "@workspace/db";
import { remindersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

const reminderSchema = z.object({
  content: z.string().min(1).max(500),
  intervalMinutes: z.number().int().min(1).max(10080),
  isActive: z.boolean().default(true),
});

router.get("/reminders/active", authenticate, async (_req, res) => {
  try {
    const reminders = await db.select().from(remindersTable).where(eq(remindersTable.isActive, true));
    res.json(reminders);
  } catch (err) {
    logger.error({ err }, "GET /reminders/active failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأذكار" });
  }
});

router.get("/reminders", authenticate, requireAdmin, async (_req, res) => {
  try {
    const reminders = await db.select().from(remindersTable).orderBy(desc(remindersTable.createdAt));
    res.json(reminders);
  } catch (err) {
    logger.error({ err }, "GET /reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأذكار" });
  }
});

router.post("/reminders", authenticate, requireAdmin, async (req, res) => {
  const body = reminderSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [reminder] = await db.insert(remindersTable).values(body.data).returning();
    res.status(201).json(reminder);
  } catch (err) {
    logger.error({ err }, "POST /reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة الذكر" });
  }
});

router.put("/reminders/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف الذكر");
  if (!id) return;

  const body = reminderSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    const [reminder] = await db.update(remindersTable).set({ ...body.data, updatedAt: new Date() }).where(eq(remindersTable.id, id)).returning();
    if (!reminder) {
      res.status(404).json({ error: "Not found", message: "الذكر غير موجود" });
      return;
    }
    res.json(reminder);
  } catch (err) {
    logger.error({ err, id }, "PUT /reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/reminders/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف الذكر");
  if (!id) return;

  try {
    await db.delete(remindersTable).where(eq(remindersTable.id, id));
    res.json({ success: true, message: "تم حذف الذكر" });
  } catch (err) {
    logger.error({ err, id }, "DELETE /reminders failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

export default router;
