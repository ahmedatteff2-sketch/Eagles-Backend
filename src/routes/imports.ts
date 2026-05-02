import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, memberSubscriptionsTable, paymentsTable, subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

router.post("/imports/members", authenticate, requireAdmin, async (req, res) => {
  const csvText = typeof req.body === "string" ? req.body : req.body?.csv;
  if (!csvText) {
    res.status(400).json({ error: "لا يوجد ملف CSV" });
    return;
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    res.status(400).json({ error: "الملف فارغ أو غير صحيح" });
    return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const name = row["name"] || row["الاسم"] || row["الاسم كامل"];
    const phone = row["phone"] || row["رقم الهاتف"] || row["الهاتف"];
    const password = row["password"] || row["كلمة المرور"] || "Gym@2024";
    const role = (row["role"] || row["الدور"] || "member") as "admin" | "member";

    if (!name || !phone) {
      results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
      continue;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    if (existing.length > 0) {
      results.skipped++;
      continue;
    }

    try {
      const hashed = await bcrypt.hash(password, 10);
      await db.insert(usersTable).values({ name, phone, password: hashed, role: role === "admin" ? "admin" : "member" });
      results.created++;
    } catch {
      results.errors.push(`خطأ في إضافة: ${name} (${phone})`);
    }
  }

  res.json({
    message: `تم الاستيراد: ${results.created} عضو جديد، ${results.skipped} مكرر، ${results.errors.length} خطأ`,
    ...results,
  });
});

router.post("/imports/payments", authenticate, requireAdmin, async (req, res) => {
  const csvText = typeof req.body === "string" ? req.body : req.body?.csv;
  if (!csvText) {
    res.status(400).json({ error: "لا يوجد ملف CSV" });
    return;
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    res.status(400).json({ error: "الملف فارغ أو غير صحيح" });
    return;
  }

  const results = { created: 0, errors: [] as string[] };

  for (const row of rows) {
    const phone = row["phone"] || row["رقم الهاتف"] || row["الهاتف"];
    const amount = row["amount"] || row["المبلغ"];
    const date = row["date"] || row["التاريخ"] || new Date().toISOString().split("T")[0];
    const method = row["method"] || row["طريقة الدفع"] || "cash";

    if (!phone || !amount) {
      results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
      continue;
    }

    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    if (!user) {
      results.errors.push(`عضو غير موجود برقم: ${phone}`);
      continue;
    }

    try {
      await db.insert(paymentsTable).values({
        userId: user.id,
        amount: String(parseFloat(amount)),
        date,
        method: ["cash", "card", "transfer"].includes(method) ? method as "cash" | "card" | "transfer" : "cash",
      });
      results.created++;
    } catch {
      results.errors.push(`خطأ في إضافة دفعة للعضو: ${phone}`);
    }
  }

  res.json({
    message: `تم الاستيراد: ${results.created} دفعة، ${results.errors.length} خطأ`,
    ...results,
  });
});

export default router;
