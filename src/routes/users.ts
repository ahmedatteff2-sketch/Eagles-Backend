import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  memberSubscriptionsTable,
  subscriptionsTable,
  checkinsTable,
  paymentsTable,
  refreshTokensTable,
  type User,
} from "@workspace/db/schema";
import { eq, ilike, or, count, sum, desc, and, ne, sql } from "drizzle-orm";
import { authenticate, requireAdmin, requireAdminOrTrainer } from "../middlewares/auth.js";
import { parseUserId, parsePagination } from "../lib/params.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";
import { z } from "zod";

const router = Router();

/**
 * Strip sensitive columns from a user row before returning it to clients.
 *
 * `passwordHash` is the bcrypt digest used at login. `totpSecret` is the
 * base32 shared secret for the user's 2FA authenticator — exposing it lets
 * anyone with the response enroll the same secret in their own authenticator
 * and bypass the second factor. Both fields are scrubbed here so callers
 * can't forget on a per-route basis.
 *
 * Add any new sensitive column (e.g. recovery codes, encrypted MFA blobs)
 * to this function rather than re-implementing the projection inline.
 */
type SafeUser = Omit<User, "passwordHash" | "totpSecret">;
function toSafeUser(user: User): SafeUser {
  // Discard names are `_`-prefixed so the project's no-unused-vars rule
  // (which allows /^_/u) skips them; we just want them off the object.
  const { passwordHash: _ph, totpSecret: _ts, ...safe } = user;
  return safe;
}

// Phone fields are normalized to digits-only at parse time so every storage
// path (create / update / import) lands the same canonical form, matching
// what /auth/login looks up. Without this, a user created with
// "010-257-54947" could never log in (the login route normalizes first).
const phoneInput = z
  .string()
  .min(5)
  .max(20)
  .regex(/^[0-9+\-\s()]{5,20}$/, "رقم هاتف غير صالح")
  .transform((s) => normalizePhone(s))
  .refine((s) => s.length >= 5 && s.length <= 20, {
    message: "رقم هاتف غير صالح",
  });

const createUserSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .transform((s) => s.trim()),
  phone: phoneInput,
  membershipNumber: z
    .string()
    .max(50)
    .optional()
    .transform((s) => s?.trim() || null),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "trainer", "member"]).default("member"),
  category: z.enum(["normal", "vip", "trial"]).default("normal"),
  // Optional trainer assignment. Empty string is treated as "unassign".
  assignedTrainerId: z.string().min(1).max(64).nullable().optional(),
});

const updateUserSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .transform((s) => s.trim())
    .optional(),
  phone: phoneInput.optional(),
  membershipNumber: z
    .string()
    .max(50)
    .optional()
    .transform((s) => (s !== undefined ? s.trim() || null : undefined)),
  role: z.enum(["admin", "trainer", "member"]).optional(),
  category: z.enum(["normal", "vip", "trial"]).optional(),
  assignedTrainerId: z.string().min(1).max(64).nullable().optional(),
});

/**
 * Validate that a referenced trainer exists and has role="trainer". Required
 * because Postgres FK constraints can't enforce "must point to a row whose
 * role column is X" — we'd need a trigger or a separate trainers table for
 * that. Cheaper to just check at the API boundary.
 */
async function ensureTrainerExists(trainerId: string, res: import("express").Response): Promise<boolean> {
  const [t] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, trainerId))
    .limit(1);
  if (!t || t.role.toLowerCase() !== "trainer") {
    res.status(400).json({ error: "Validation error", message: "المدرب غير موجود" });
    return false;
  }
  return true;
}

router.get("/users", authenticate, requireAdminOrTrainer, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query.page, req.query.limit, 100);
  const rawSearch = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : undefined;
  // Escape LIKE special characters to prevent wildcard injection
  const search = rawSearch?.replace(/[%_\\]/g, (c) => `\\${c}`);
  // Optional trainer filter (admins can pass ?trainerId=... explicitly to
  // see only members assigned to one trainer). Trainers always see their
  // own assigned members regardless of the query param.
  const trainerFilterRaw =
    typeof req.query.trainerId === "string" ? req.query.trainerId.slice(0, 64) : undefined;
  const isTrainer = req.user!.role === "trainer";
  // Effective trainer filter: trainers see only their own; admins use the
  // optional query param.
  const effectiveTrainerId = isTrainer ? req.user!.userId : trainerFilterRaw;
  // Optional sort: "renewal" orders members by their most recent subscription
  // (i.e. last renewal) first, so a member who just renewed surfaces at the
  // top of the list. Anything else falls back to newest-registered first.
  const sortByRenewal = req.query.sort === "renewal";

  try {
    const baseFilters = [eq(usersTable.role, "member")];
    if (effectiveTrainerId) baseFilters.push(eq(usersTable.assignedTrainerId, effectiveTrainerId));
    let whereClause = and(...baseFilters);
    if (search) {
      whereClause = and(
        ...baseFilters,
        or(
          ilike(usersTable.name, `%${search}%`),
          ilike(usersTable.phone, `%${search}%`),
          ilike(usersTable.membershipNumber, `%${search}%`),
          eq(usersTable.id, search),
        ),
      );
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(whereClause)
      // Sort by last renewal (most recent member_subscription) when requested,
      // otherwise by signup date. The correlated subquery keeps the SELECT
      // shape flat (just User columns) so downstream mapping is unchanged.
      .orderBy(
        sortByRenewal
          ? sql`(SELECT MAX(${memberSubscriptionsTable.createdAt}) FROM ${memberSubscriptionsTable} WHERE ${memberSubscriptionsTable.userId} = ${usersTable.id}) DESC NULLS LAST`
          : desc(usersTable.createdAt),
      )
      .limit(limit)
      .offset(offset);
    const [totalRow] = await db.select({ count: count() }).from(usersTable).where(whereClause);

    // Single JOIN query for subscriptions (avoids N+1)
    const userIds = users.map((u) => u.id);
    type SubInfo = {
      id: number;
      userId: string;
      subscriptionId: number;
      startDate: string;
      endDate: string;
      status: "active" | "expired" | "frozen";
      subscription: { id: number; name: string; duration: number; price: string };
    };
    const subsMap: Record<string, SubInfo> = {};
    if (userIds.length > 0) {
      const allSubs = await db
        .select({
          userId: memberSubscriptionsTable.userId,
          id: memberSubscriptionsTable.id,
          subscriptionId: memberSubscriptionsTable.subscriptionId,
          startDate: memberSubscriptionsTable.startDate,
          endDate: memberSubscriptionsTable.endDate,
          status: memberSubscriptionsTable.status,
          subName: subscriptionsTable.name,
          subDuration: subscriptionsTable.duration,
          subPrice: subscriptionsTable.price,
          subId: subscriptionsTable.id,
        })
        .from(memberSubscriptionsTable)
        .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
        .orderBy(desc(memberSubscriptionsTable.createdAt));

      for (const s of allSubs) {
        if (!subsMap[s.userId]) {
          subsMap[s.userId] = {
            id: s.id,
            userId: s.userId,
            subscriptionId: s.subscriptionId,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status,
            subscription: { id: s.subId, name: s.subName, duration: s.subDuration, price: s.subPrice },
          };
        }
      }
    }

    const usersWithSubs = users.map((u) => ({
      ...toSafeUser(u),
      currentSubscription: subsMap[u.id] ?? null,
    }));

    res.json({ data: usersWithSubs, total: totalRow?.count ?? 0, page, limit });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب الأعضاء" });
  }
});

router.post("/users", authenticate, requireAdmin, async (req, res) => {
  const body = createUserSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", message: "بيانات غير صالحة" });
    return;
  }
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, body.data.phone))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "رقم الهاتف مستخدم بالفعل" });
      return;
    }
    if (body.data.membershipNumber) {
      const existingCode = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.membershipNumber, body.data.membershipNumber))
        .limit(1);
      if (existingCode.length > 0) {
        res.status(409).json({ error: "Conflict", message: "الكود التعريفي مستخدم بالفعل" });
        return;
      }
    }
    if (body.data.assignedTrainerId) {
      const ok = await ensureTrainerExists(body.data.assignedTrainerId, res);
      if (!ok) return;
    }
    const hashed = await bcrypt.hash(body.data.password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({
        id: crypto.randomUUID(),
        name: body.data.name,
        phone: body.data.phone,
        membershipNumber: body.data.membershipNumber,
        passwordHash: hashed,
        role: body.data.role,
        category: body.data.category ?? "normal",
        assignedTrainerId: body.data.assignedTrainerId ?? null,
      })
      .returning();
    res.status(201).json(toSafeUser(user));
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء إضافة العضو" });
  }
});

router.get("/users/:userId", authenticate, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
  if (!userId) return;

  // Access policy:
  //   admin   → any user
  //   trainer → self, or a member they are assigned to
  //   member  → self only
  if (req.user!.role !== "admin" && req.user!.userId !== userId) {
    if (req.user!.role !== "trainer") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [target] = await db
      .select({ assignedTrainerId: usersTable.assignedTrainerId, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const allowed = target && target.role === "member" && target.assignedTrainerId === req.user!.userId;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [currentSubscription] = await db
      .select({
        id: memberSubscriptionsTable.id,
        userId: memberSubscriptionsTable.userId,
        subscriptionId: memberSubscriptionsTable.subscriptionId,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
        subscription: {
          id: subscriptionsTable.id,
          name: subscriptionsTable.name,
          duration: subscriptionsTable.duration,
          price: subscriptionsTable.price,
        },
      })
      .from(memberSubscriptionsTable)
      .innerJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(eq(memberSubscriptionsTable.userId, userId))
      .orderBy(desc(memberSubscriptionsTable.createdAt))
      .limit(1);

    const recentCheckins = await db
      .select()
      .from(checkinsTable)
      .where(eq(checkinsTable.userId, userId))
      .orderBy(desc(checkinsTable.timestamp))
      .limit(5);
    const [paySum] = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(eq(paymentsTable.userId, userId));

    res.json({
      ...toSafeUser(user),
      currentSubscription: currentSubscription ?? null,
      recentCheckins,
      totalPayments: Number(paySum?.total ?? 0),
    });
  } catch {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء جلب بيانات العضو" });
  }
});

/**
 * Refuses to demote/delete the last remaining admin so the gym can never be
 * locked out of its own admin panel. Returns true if the operation should
 * proceed.
 */
async function ensureNotLastAdmin(userId: string, res: import("express").Response): Promise<boolean> {
  const [target] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!target || target.role.toLowerCase() !== "admin") return true;
  const [{ count: otherAdmins } = { count: 0 }] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, userId)));
  if ((otherAdmins ?? 0) === 0) {
    res.status(409).json({
      error: "Conflict",
      message: "لا يمكن حذف/تخفيض آخر مسؤول في النظام",
    });
    return false;
  }
  return true;
}

router.put("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
  if (!userId) return;

  const body = updateUserSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  try {
    // Don't let an admin demote themselves or anyone else if they're the only
    // admin left — same lock-out concern as deletion.
    if (body.data.role && body.data.role !== "admin") {
      const ok = await ensureNotLastAdmin(userId, res);
      if (!ok) return;
    }
    if (body.data.phone) {
      const existingPhone = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.phone, body.data.phone))
        .limit(1);
      if (existingPhone.length > 0 && existingPhone[0].id !== userId) {
        res.status(409).json({ error: "Conflict", message: "رقم الهاتف مستخدم بالفعل" });
        return;
      }
    }
    if (body.data.membershipNumber) {
      const existingCode = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.membershipNumber, body.data.membershipNumber))
        .limit(1);
      if (existingCode.length > 0 && existingCode[0].id !== userId) {
        res.status(409).json({ error: "Conflict", message: "الكود التعريفي مستخدم بالفعل" });
        return;
      }
    }
    if (body.data.assignedTrainerId) {
      const ok = await ensureTrainerExists(body.data.assignedTrainerId, res);
      if (!ok) return;
    }

    const [user] = await db.update(usersTable).set(body.data).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(toSafeUser(user));
  } catch (err) {
    logger.error({ err, userId }, "PUT /users/:userId failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء التحديث" });
  }
});

router.delete("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
  if (!userId) return;

  try {
    const ok = await ensureNotLastAdmin(userId, res);
    if (!ok) return;
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true, message: "تم حذف العضو" });
  } catch (err) {
    logger.error({ err, userId }, "DELETE /users/:userId failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء الحذف" });
  }
});

const resetPasswordSchema = z.object({
  // bcrypt's effective input is 72 bytes; reject longer values up-front so
  // an over-long password isn't silently truncated and accepted on login.
  newPassword: z.string().min(8).max(72),
});

/**
 * List all users with role="trainer". Used by the admin members page to
 * populate the "assign trainer" dropdown. Returns a minimal projection
 * (id + name) since the dropdown doesn't need anything else — phone numbers
 * were previously exposed here and let any trainer harvest every other
 * trainer's contact info.
 */
router.get("/trainers", authenticate, requireAdminOrTrainer, async (_req, res) => {
  const trainers = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.role, "trainer"))
    .orderBy(usersTable.name);
  res.json(trainers);
});

router.post("/users/:userId/reset-password", authenticate, requireAdmin, async (req, res) => {
  const userId = parseUserId(req.params.userId, res);
  if (!userId) return;

  // Validate the body via Zod first so unexpected shapes (numbers, objects,
  // missing fields) hit the 400 path before we touch req.body.newPassword.
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation error",
      message: "كلمة المرور يجب أن تكون بين 8 و 72 حرف",
    });
    return;
  }
  try {
    const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.update(usersTable).set({ passwordHash: hashed }).where(eq(usersTable.id, userId));
    // Force re-login on every device the target user is signed in on — a
    // password reset implies the previous credentials might be compromised.
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, userId));
    res.json({ success: true, message: "تم إعادة تعيين كلمة المرور" });
  } catch (err) {
    logger.error({ err, userId }, "POST /users/:userId/reset-password failed");
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

export default router;
