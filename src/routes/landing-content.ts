import { Router } from "express";
import { db } from "@workspace/db";
import { landingContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { landingContentSchema, DEFAULT_LANDING_CONTENT } from "../lib/landing-content.js";

const router = Router();

// Public: the standalone marketing landing build fetches this to render. It
// must never 500 the public page, so any failure falls back to the defaults.
router.get("/landing-content", async (_req, res) => {
  try {
    const [row] = await db.select().from(landingContentTable).where(eq(landingContentTable.id, 1)).limit(1);
    res.setHeader("Cache-Control", "no-cache");
    res.json(row?.content ?? DEFAULT_LANDING_CONTENT);
  } catch (err) {
    logger.error({ err }, "GET /landing-content failed");
    res.setHeader("Cache-Control", "no-cache");
    res.json(DEFAULT_LANDING_CONTENT);
  }
});

router.put("/landing-content", authenticate, requireAdmin, async (req, res) => {
  const parsed = landingContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const [row] = await db
      .insert(landingContentTable)
      .values({ id: 1, content: parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: landingContentTable.id,
        set: { content: parsed.data, updatedAt: new Date() },
      })
      .returning();
    res.json(row.content);
  } catch (err) {
    logger.error({ err }, "PUT /landing-content failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء حفظ المحتوى" });
  }
});

export default router;
