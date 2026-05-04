import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, memberSubscriptionsTable, subscriptionsTable, paymentsTable,
  trainingProgramsTable, trainingWeeksTable, exercisesTable, exerciseLogsTable,
  bodyStatsTable, checkinsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// Simple native CSV generator — no external library needed
function toCSV(fields: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = fields.join(",");
  const lines = rows.map((r) => fields.map((f) => escape(r[f])).join(","));
  return [header, ...lines].join("\n");
}

router.get("/exports/members-csv", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        createdAt: usersTable.createdAt,
        planName: subscriptionsTable.name,
        startDate: memberSubscriptionsTable.startDate,
        endDate: memberSubscriptionsTable.endDate,
        status: memberSubscriptionsTable.status,
      })
      .from(usersTable)
      .leftJoin(memberSubscriptionsTable, eq(memberSubscriptionsTable.userId, usersTable.id))
      .leftJoin(subscriptionsTable, eq(memberSubscriptionsTable.subscriptionId, subscriptionsTable.id))
      .where(eq(usersTable.role, "member"))
      .orderBy(desc(usersTable.createdAt));

    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const csv = toCSV(
      ["id", "name", "phone", "createdAt", "planName", "startDate", "endDate", "status"],
      unique as Record<string, unknown>[],
    );

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=members.csv",
    });
    res.send("\uFEFF" + csv); // BOM for Excel Arabic support
  } catch (err) {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تصدير البيانات" });
  }
});

router.get("/exports/payments-csv", authenticate, requireAdmin, async (_req, res) => {
  try {
    const payments = await db
      .select({
        id: paymentsTable.id,
        userName: usersTable.name,
        phone: usersTable.phone,
        amount: paymentsTable.amount,
        method: paymentsTable.method,
        date: paymentsTable.date,
      })
      .from(paymentsTable)
      .innerJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
      .orderBy(desc(paymentsTable.date));

    const csv = toCSV(
      ["id", "userName", "phone", "amount", "method", "date"],
      payments as Record<string, unknown>[],
    );

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=payments.csv",
    });
    res.send("\uFEFF" + csv);
  } catch (err) {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تصدير البيانات" });
  }
});

router.get("/exports/full-backup", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [
      users, subscriptionsList, memberSubs, programs,
      weeks, exerciseList, exerciseLogs, bodyStats, checkins, payments,
    ] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable),
      db.select().from(subscriptionsTable),
      db.select().from(memberSubscriptionsTable),
      db.select().from(trainingProgramsTable),
      db.select().from(trainingWeeksTable),
      db.select().from(exercisesTable),
      db.select().from(exerciseLogsTable),
      db.select().from(bodyStatsTable),
      db.select().from(checkinsTable),
      db.select().from(paymentsTable),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      users,
      subscriptions: subscriptionsList,
      memberSubs,
      programs,
      weeks,
      exercises: exerciseList,
      exerciseLogs,
      bodyStats,
      checkins,
      payments,
    };

    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=eagle-gym-backup-${new Date().toISOString().split("T")[0]}.json`,
    });
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: "Internal server error", message: "حدث خطأ أثناء تصدير النسخة الاحتياطية" });
  }
});

export default router;
