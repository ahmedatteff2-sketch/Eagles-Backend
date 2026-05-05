import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const router = Router();

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

router.post("/imports/members", authenticate, requireAdmin, async (req, res) => {
  try {
    const csvText = typeof req.body === "string" ? req.body : req.body?.csv;
    if (!csvText || !csvText.trim()) {
      res.status(400).json({ error: "لا يوجد ملف CSV", message: "يرجى رفع ملف CSV أو لصق البيانات" });
      return;
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      res.status(400).json({ error: "الملف فارغ أو غير صحيح", message: "تأكد من تنسيق ملف CSV" });
      return;
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      const name = row["name"] || row["الاسم"] || row["الاسم كامل"] || "";
      const phone = row["phone"] || row["رقم الهاتف"] || row["الهاتف"] || "";
      const password = row["password"] || row["كلمة المرور"] || randomBytes(8).toString("base64url");
      const rawRole = (row["role"] || row["الدور"] || "member").toLowerCase();
      const role: "admin" | "member" = rawRole === "admin" ? "admin" : "member";

      if (!name.trim() || !phone.trim()) {
        results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const existing = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.phone, phone.trim()))
          .limit(1);

        if (existing.length > 0) {
          results.skipped++;
          continue;
        }

        const hashed = await bcrypt.hash(password, 10);
        await db.insert(usersTable).values({
          id: crypto.randomUUID(),
          name: name.trim(),
          phone: phone.trim(),
          passwordHash: hashed,
          role,
        });
        results.created++;
      } catch (rowErr: any) {
        results.errors.push(`خطأ في إضافة ${name} (${phone}): ${rowErr?.message ?? "خطأ غير معروف"}`);
      }
    }

    res.json({
      message: `تم الاستيراد: ${results.created} عضو جديد، ${results.skipped} مكرر، ${results.errors.length} خطأ`,
      ...results,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "خطأ في الاستيراد",
      message: err?.message ?? "حدث خطأ غير متوقع أثناء استيراد الأعضاء",
    });
  }
});

router.post("/imports/payments", authenticate, requireAdmin, async (req, res) => {
  try {
    const csvText = typeof req.body === "string" ? req.body : req.body?.csv;
    if (!csvText || !csvText.trim()) {
      res.status(400).json({ error: "لا يوجد ملف CSV", message: "يرجى رفع ملف CSV أو لصق البيانات" });
      return;
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      res.status(400).json({ error: "الملف فارغ أو غير صحيح", message: "تأكد من تنسيق ملف CSV" });
      return;
    }

    const results = { created: 0, errors: [] as string[] };

    for (const row of rows) {
      const phone = (row["phone"] || row["رقم الهاتف"] || row["الهاتف"] || "").trim();
      const amount = (row["amount"] || row["المبلغ"] || "").trim();
      const date = (row["date"] || row["التاريخ"] || new Date().toISOString().split("T")[0]).trim();
      const method = (row["method"] || row["طريقة الدفع"] || "cash").trim();

      if (!phone || !amount) {
        results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
        continue;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        results.errors.push(`مبلغ غير صحيح للرقم ${phone}: ${amount}`);
        continue;
      }

      try {
        const [user] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.phone, phone))
          .limit(1);

        if (!user) {
          results.errors.push(`عضو غير موجود برقم: ${phone}`);
          continue;
        }

        const validMethod = ["cash", "card", "transfer"].includes(method)
          ? (method as "cash" | "card" | "transfer")
          : "cash";

        await db.insert(paymentsTable).values({
          userId: user.id,
          amount: String(parsedAmount),
          date,
          method: validMethod,
        });
        results.created++;
      } catch (rowErr: any) {
        results.errors.push(`خطأ في دفعة رقم ${phone}: ${rowErr?.message ?? "خطأ غير معروف"}`);
      }
    }

    res.json({
      message: `تم الاستيراد: ${results.created} دفعة، ${results.errors.length} خطأ`,
      ...results,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "خطأ في الاستيراد",
      message: err?.message ?? "حدث خطأ غير متوقع أثناء استيراد المدفوعات",
    });
  }
});

export default router;
