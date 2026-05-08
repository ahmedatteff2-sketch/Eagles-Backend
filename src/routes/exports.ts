import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, memberSubscriptionsTable, subscriptionsTable, paymentsTable,
  exercisesTable, workoutTemplatesTable, workoutTemplateExercisesTable, memberWorkoutAssignmentsTable,
  exerciseLogsTable, bodyStatsTable, checkinsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";

const router = Router();

// Simple native CSV generator — no external library needed
function toCSV(fields: string[], rows: Record<string, unknown>[]): string {
  // CSV-injection ("formula injection"): a value beginning with one of these
  // characters is interpreted by Excel/Sheets/Numbers as a formula on open.
  // Prefix a single quote to neutralize the formula while keeping the value
  // visually identical when rendered.
  const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];
  const escape = (v: unknown): string => {
    let s = v == null ? "" : String(v);
    if (s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) {
      s = "'" + s;
    }
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = fields.map((f) => escape(f)).join(",");
  const lines = rows.map((r) => fields.map((f) => escape(r[f])).join(","));
  // CRLF is the canonical CSV line terminator and avoids Excel quirks.
  return [header, ...lines].join("\r\n");
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
      users, subscriptionsList, memberSubs,
      exerciseList, workoutTemplates, templateExercises, workoutAssignments,
      exerciseLogs, bodyStats, checkins, payments,
    ] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable),
      db.select().from(subscriptionsTable),
      db.select().from(memberSubscriptionsTable),
      db.select().from(exercisesTable),
      db.select().from(workoutTemplatesTable),
      db.select().from(workoutTemplateExercisesTable),
      db.select().from(memberWorkoutAssignmentsTable),
      db.select().from(exerciseLogsTable),
      db.select().from(bodyStatsTable),
      db.select().from(checkinsTable),
      db.select().from(paymentsTable),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      users,
      subscriptions: subscriptionsList,
      memberSubs,
      exercises: exerciseList,
      workoutTemplates,
      templateExercises,
      workoutAssignments,
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
