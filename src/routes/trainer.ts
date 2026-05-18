/**
 * `/api/trainer/*` — the trainer-portal API. Every route gates on
 * `requireTrainer` (see middlewares/auth.ts) so admins are not silently
 * authorized; admin tooling lives under `/api/users` etc.
 *
 * Like routes/auth.ts, this file is strictly HTTP: parse Zod schemas,
 * delegate to `services/trainer.service.ts`, map the tagged outcome to
 * a JSON response. No drizzle imports here.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticate, requireTrainer } from "../middlewares/auth.js";
import * as trainer from "../services/trainer.service.js";
import { TRAINER_NOTE_CATEGORIES } from "@workspace/db/schema";

const router = Router();

const createNoteSchema = z.object({
  note: z.string().min(1).max(2000),
  // Validated again in the service, but rejecting at the boundary gives
  // a better error message and keeps the service contract simple.
  category: z.enum(TRAINER_NOTE_CATEGORIES).default("general"),
  pinned: z.boolean().optional(),
});

const updateNoteSchema = z.object({
  note: z.string().min(1).max(2000).optional(),
  category: z.enum(TRAINER_NOTE_CATEGORIES).optional(),
  pinned: z.boolean().optional(),
});

// All trainer routes require a logged-in trainer. Layered here so we never
// forget on a per-handler basis.
router.use("/trainer", authenticate, requireTrainer);

// ── Dashboard ─────────────────────────────────────────────────────────────

router.get("/trainer/dashboard", async (req, res) => {
  const summary = await trainer.getDashboardSummary(req.user!.userId);
  const pinned = await trainer.listPinnedNotesWithMember(req.user!.userId);
  const recentNotes = await trainer.listRecentNotes(req.user!.userId, 10);
  res.json({ summary, pinnedNotes: pinned, recentNotes });
});

// ── Members ───────────────────────────────────────────────────────────────

router.get("/trainer/members", async (req, res) => {
  const members = await trainer.listMembers(req.user!.userId);
  res.json({ data: members, total: members.length });
});

router.get("/trainer/members/:memberId", async (req, res) => {
  const memberId = String(req.params.memberId).slice(0, 64);
  const profile = await trainer.getMemberProfile(req.user!.userId, memberId);
  if (!profile) {
    res.status(404).json({ error: "Not found", message: "العضو غير موجود أو غير مخصص لك" });
    return;
  }
  res.json(profile);
});

// ── Schedule ──────────────────────────────────────────────────────────────

router.get("/trainer/schedule", async (req, res) => {
  const sessions = await trainer.getMySchedule(req.user!.userId);
  res.json({ data: sessions });
});

// ── Performance ───────────────────────────────────────────────────────────

router.get("/trainer/performance", async (req, res) => {
  const metrics = await trainer.getPerformance(req.user!.userId);
  res.json(metrics);
});

// ── Notes (CRUD) ──────────────────────────────────────────────────────────

router.post("/trainer/members/:memberId/notes", async (req, res) => {
  const body = createNoteSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const memberId = String(req.params.memberId).slice(0, 64);
  const outcome = await trainer.createNoteForMember(req.user!.userId, memberId, body.data);
  switch (outcome.type) {
    case "ok":
      res.status(201).json(outcome.note);
      return;
    case "not_assigned":
      res.status(403).json({ error: "Forbidden", message: "العضو غير مخصص لك" });
      return;
    case "invalid_category":
      res.status(400).json({ error: "Validation error", message: "فئة غير صالحة" });
      return;
  }
});

router.patch("/trainer/notes/:noteId", async (req, res) => {
  const body = updateNoteSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    res.status(400).json({ error: "Validation error", message: "معرّف غير صالح" });
    return;
  }
  const outcome = await trainer.updateNote(req.user!.userId, noteId, body.data);
  switch (outcome.type) {
    case "ok":
      res.json(outcome.note);
      return;
    case "not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "forbidden":
      res.status(403).json({ error: "Forbidden", message: "لا يمكن تعديل ملاحظة لمدرب آخر" });
      return;
    case "invalid_category":
      res.status(400).json({ error: "Validation error", message: "فئة غير صالحة" });
      return;
  }
});

router.delete("/trainer/notes/:noteId", async (req, res) => {
  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    res.status(400).json({ error: "Validation error", message: "معرّف غير صالح" });
    return;
  }
  const outcome = await trainer.deleteNote(req.user!.userId, noteId);
  switch (outcome.type) {
    case "ok":
      res.status(204).end();
      return;
    case "not_found":
      res.status(404).json({ error: "Not found" });
      return;
    case "forbidden":
      res.status(403).json({ error: "Forbidden", message: "لا يمكن حذف ملاحظة لمدرب آخر" });
      return;
  }
});

export default router;
