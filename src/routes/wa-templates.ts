import { Router } from "express";
import { db } from "@workspace/db";
import { waTemplatesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { parseId } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router = Router();

// Body length is generous because WhatsApp itself allows up to 4096 chars per
// message. We cap at 2000 to keep DB rows compact and discourage walls of text.
const templateSchema = z.object({
  name: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

router.get("/wa-templates", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(waTemplatesTable).orderBy(asc(waTemplatesTable.sortOrder), asc(waTemplatesTable.id));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /wa-templates failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب القوالب" });
  }
});

router.post("/wa-templates", authenticate, requireAdmin, async (req, res) => {
  const body = templateSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [tpl] = await db.insert(waTemplatesTable).values(body.data).returning();
    res.status(201).json(tpl);
  } catch (err) {
    logger.error({ err }, "POST /wa-templates failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة القالب" });
  }
});

router.put("/wa-templates/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف القالب");
  if (!id) return;
  const body = templateSchema.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [tpl] = await db.update(waTemplatesTable).set({ ...body.data, updatedAt: new Date() }).where(eq(waTemplatesTable.id, id)).returning();
    if (!tpl) {
      res.status(404).json({ error: "Not found", message: "القالب غير موجود" });
      return;
    }
    res.json(tpl);
  } catch (err) {
    logger.error({ err, id }, "PUT /wa-templates failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/wa-templates/:id", authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, res, "معرّف القالب");
  if (!id) return;
  try {
    await db.delete(waTemplatesTable).where(eq(waTemplatesTable.id, id));
    res.json({ success: true, message: "تم حذف القالب" });
  } catch (err) {
    logger.error({ err, id }, "DELETE /wa-templates failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

export default router;
