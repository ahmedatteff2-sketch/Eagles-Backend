import { Router } from "express";
import { db } from "@workspace/db";
import { refreshTokensTable } from "@workspace/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { authenticate } from "../middlewares/auth.js";
import { recordAuditEvent } from "../middlewares/audit.js";

const router = Router();

/**
 * List the currently-active refresh-token rows for the authenticated user.
 *
 * "Active" means: not revoked AND not expired. Each row corresponds to a
 * physical sign-in (one per browser/device pair). The frontend uses this to
 * render a "where you're signed in" panel.
 *
 * The token hash itself is intentionally NOT returned — only metadata. We
 * have nowhere to store the original token (it lives only in the user's
 * client) and exposing the hash gives an attacker with read-only DB access
 * a way to enumerate sessions without compromising further.
 */
router.get("/auth/sessions", authenticate, async (req, res) => {
  const rows = await db
    .select({
      id: refreshTokensTable.id,
      label: refreshTokensTable.label,
      userAgent: refreshTokensTable.userAgent,
      ip: refreshTokensTable.ip,
      lastUsedAt: refreshTokensTable.lastUsedAt,
      createdAt: refreshTokensTable.createdAt,
      expiresAt: refreshTokensTable.expiresAt,
    })
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.userId, req.user!.userId),
        eq(refreshTokensTable.revoked, false),
        gt(refreshTokensTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(refreshTokensTable.createdAt));
  res.json(rows);
});

router.delete("/auth/sessions/:id", authenticate, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Validation error", message: "Invalid session id" });
    return;
  }
  // Scope the revocation to the calling user's own sessions only — admins
  // can't revoke other people's sessions through this endpoint by design;
  // that's a separate (deliberately gated) admin tool.
  const result = await db
    .update(refreshTokensTable)
    .set({ revoked: true })
    .where(and(eq(refreshTokensTable.id, id), eq(refreshTokensTable.userId, req.user!.userId)))
    .returning({ id: refreshTokensTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  void recordAuditEvent(req, "auth.session.revoke", {
    status: 200,
    targetType: "session",
    targetId: String(id),
  });
  res.json({ success: true });
});

router.post("/auth/sessions/revoke-all", authenticate, async (req, res) => {
  await db
    .update(refreshTokensTable)
    .set({ revoked: true })
    .where(and(eq(refreshTokensTable.userId, req.user!.userId), eq(refreshTokensTable.revoked, false)));
  void recordAuditEvent(req, "auth.session.revoke_all", { status: 200 });
  res.json({ success: true });
});

export default router;
