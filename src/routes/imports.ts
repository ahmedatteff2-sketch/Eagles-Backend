import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import Papa from "papaparse";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";
import multer from "multer";
// @ts-expect-error sql.js has no type declarations
import initSqlJs from "sql.js";
import { readFileSync, unlinkSync } from "fs";
import path from "path";
import os from "os";

const router = Router();

// Hard caps on accepted CSV input. Tuned to comfortably cover real gym
// imports while preventing pathological "import 1M rows" payloads from tying
// up the worker for minutes (each row costs a bcrypt + DB roundtrip).
const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB raw text
const MAX_CSV_ROWS = 5_000;
const BCRYPT_COST = 12;

type Row = Record<string, string>;

interface ParsedCSV {
  rows: Row[];
  error?: string;
}

function parseCSV(text: string): ParsedCSV {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  if (parsed.errors && parsed.errors.length > 0) {
    return { rows: [], error: parsed.errors[0]?.message ?? "تنسيق CSV غير صحيح" };
  }
  return { rows: (parsed.data ?? []) as Row[] };
}

function readCsvFromBody(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "csv" in body) {
    const csv = (body as { csv?: unknown }).csv;
    if (typeof csv === "string") return csv;
  }
  return null;
}

function rejectIfTooLarge(csvText: string, res: import("express").Response): boolean {
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    res.status(413).json({
      error: "Payload too large",
      message: `الحد الأقصى لحجم ملف CSV هو ${MAX_CSV_BYTES / 1024 / 1024}MB`,
    });
    return true;
  }
  return false;
}

router.post("/imports/members", authenticate, requireAdmin, async (req, res) => {
  try {
    const csvText = readCsvFromBody(req.body);
    if (!csvText || !csvText.trim()) {
      res.status(400).json({ error: "لا يوجد ملف CSV", message: "يرجى رفع ملف CSV أو لصق البيانات" });
      return;
    }
    if (rejectIfTooLarge(csvText, res)) return;

    const parsed = parseCSV(csvText);
    if (parsed.error) {
      res.status(400).json({ error: "تنسيق غير صحيح", message: parsed.error });
      return;
    }
    if (parsed.rows.length === 0) {
      res.status(400).json({ error: "الملف فارغ أو غير صحيح", message: "تأكد من تنسيق ملف CSV" });
      return;
    }
    if (parsed.rows.length > MAX_CSV_ROWS) {
      res.status(413).json({
        error: "Too many rows",
        message: `الحد الأقصى لعدد الصفوف هو ${MAX_CSV_ROWS}`,
      });
      return;
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of parsed.rows) {
      const name = (row["name"] || row["الاسم"] || row["الاسم كامل"] || "").trim();
      const rawPhone = (row["phone"] || row["رقم الهاتف"] || row["الهاتف"] || "").trim();
      const phone = normalizePhone(rawPhone);
      // Generated random passwords are 16 chars; bcrypt's effective input limit
      // is 72 bytes so we slice anything longer to stay inside that bound.
      const rawPassword = (row["password"] || row["كلمة المرور"] || randomBytes(12).toString("base64url")).toString();
      const password = rawPassword.length > 72 ? rawPassword.slice(0, 72) : rawPassword;
      const rawRole = (row["role"] || row["الدور"] || "member").toLowerCase();
      const role: "admin" | "member" = rawRole === "admin" ? "admin" : "member";

      if (!name || !phone) {
        results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
        continue;
      }
      if (password.length < 8) {
        results.errors.push(`كلمة المرور قصيرة جداً للعضو ${name} (${phone})`);
        continue;
      }

      try {
        const existing = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.phone, phone))
          .limit(1);

        if (existing.length > 0) {
          results.skipped++;
          continue;
        }

        const hashed = await bcrypt.hash(password, BCRYPT_COST);
        await db.insert(usersTable).values({
          id: randomUUID(),
          name,
          phone,
          passwordHash: hashed,
          role,
        });
        results.created++;
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : "خطأ غير معروف";
        logger.error({ err: rowErr, name, phone }, "Member import row failed");
        results.errors.push(`خطأ في إضافة ${name} (${phone}): ${msg}`);
      }
    }

    res.json({
      message: `تم الاستيراد: ${results.created} عضو جديد، ${results.skipped} مكرر، ${results.errors.length} خطأ`,
      ...results,
    });
  } catch (err) {
    logger.error({ err }, "Members import failed");
    res.status(500).json({
      error: "خطأ في الاستيراد",
      message: "حدث خطأ غير متوقع أثناء استيراد الأعضاء",
    });
  }
});

router.post("/imports/payments", authenticate, requireAdmin, async (req, res) => {
  try {
    const csvText = readCsvFromBody(req.body);
    if (!csvText || !csvText.trim()) {
      res.status(400).json({ error: "لا يوجد ملف CSV", message: "يرجى رفع ملف CSV أو لصق البيانات" });
      return;
    }
    if (rejectIfTooLarge(csvText, res)) return;

    const parsed = parseCSV(csvText);
    if (parsed.error) {
      res.status(400).json({ error: "تنسيق غير صحيح", message: parsed.error });
      return;
    }
    if (parsed.rows.length === 0) {
      res.status(400).json({ error: "الملف فارغ أو غير صحيح", message: "تأكد من تنسيق ملف CSV" });
      return;
    }
    if (parsed.rows.length > MAX_CSV_ROWS) {
      res.status(413).json({
        error: "Too many rows",
        message: `الحد الأقصى لعدد الصفوف هو ${MAX_CSV_ROWS}`,
      });
      return;
    }

    const results = { created: 0, errors: [] as string[] };

    for (const row of parsed.rows) {
      const rawPhone = (row["phone"] || row["رقم الهاتف"] || row["الهاتف"] || "").trim();
      const phone = normalizePhone(rawPhone);
      const amount = (row["amount"] || row["المبلغ"] || "").trim();
      const date = (row["date"] || row["التاريخ"] || new Date().toISOString().split("T")[0]).trim();
      const method = (row["method"] || row["طريقة الدفع"] || "cash").trim();

      if (!phone || !amount) {
        results.errors.push(`صف مفقود البيانات: ${JSON.stringify(row)}`);
        continue;
      }

      const parsedAmount = parseFloat(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        results.errors.push(`مبلغ غير صحيح للرقم ${phone}: ${amount}`);
        continue;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        results.errors.push(`تاريخ غير صحيح للرقم ${phone}: ${date}`);
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
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : "خطأ غير معروف";
        logger.error({ err: rowErr, phone }, "Payment import row failed");
        results.errors.push(`خطأ في دفعة رقم ${phone}: ${msg}`);
      }
    }

    res.json({
      message: `تم الاستيراد: ${results.created} دفعة، ${results.errors.length} خطأ`,
      ...results,
    });
  } catch (err) {
    logger.error({ err }, "Payments import failed");
    res.status(500).json({
      error: "خطأ في الاستيراد",
      message: "حدث خطأ غير متوقع أثناء استيراد المدفوعات",
    });
  }
});

// ── SQLite import ─────────────────────────────────────────────────────────────

const MAX_SQLITE_BYTES = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  dest: path.join(os.tmpdir(), "eagle-uploads"),
  limits: { fileSize: MAX_SQLITE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".sqlite" || ext === ".db" || ext === ".sqlite3") {
      cb(null, true);
    } else {
      cb(new Error("يجب رفع ملف SQLite (.sqlite, .db, .sqlite3)"));
    }
  },
});

interface SqliteRow {
  name?: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  role?: string;
  category?: string;
  membershipNumber?: string;
  [key: string]: unknown;
}

router.post(
  "/imports/members/sqlite",
  authenticate,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const filePath = req.file?.path;
    try {
      if (!req.file || !filePath) {
        res.status(400).json({
          error: "لا يوجد ملف",
          message: "يرجى رفع ملف SQLite (.sqlite, .db, .sqlite3)",
        });
        return;
      }

      const SQL = await initSqlJs();
      let sqliteDb: InstanceType<typeof SQL.Database>;
      try {
        const fileBuffer = readFileSync(filePath);
        sqliteDb = new SQL.Database(fileBuffer);
      } catch {
        res.status(400).json({
          error: "ملف غير صالح",
          message: "لا يمكن فتح الملف كقاعدة بيانات SQLite",
        });
        return;
      }

      // Find the members/users table in the SQLite file
      const tablesResult = sqliteDb.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      const tableNames = (tablesResult[0]?.values ?? []).map((r: unknown[]) => String(r[0]));

      const targetNames = ["members", "users", "member", "user", "أعضاء", "الأعضاء"];
      const tableName = tableNames.find((t: string) =>
        targetNames.includes(t.toLowerCase()),
      );

      if (!tableName) {
        sqliteDb.close();
        res.status(400).json({
          error: "جدول غير موجود",
          message: `لم يتم العثور على جدول الأعضاء. الجداول الموجودة: ${tableNames.join(", ")}`,
        });
        return;
      }

      const result = sqliteDb.exec(`SELECT * FROM "${tableName}"`);
      sqliteDb.close();

      const columns = result[0]?.columns ?? [];
      const rows: SqliteRow[] = (result[0]?.values ?? []).map((vals: unknown[]) => {
        const row: SqliteRow = {};
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = vals[i] != null ? String(vals[i]) : undefined;
        }
        return row;
      });

      if (rows.length === 0) {
        res.status(400).json({
          error: "الجدول فارغ",
          message: "جدول الأعضاء في ملف SQLite فارغ",
        });
        return;
      }

      // Delete all existing members (cascade handles related data)
      const deletedRows = await db
        .delete(usersTable)
        .where(eq(usersTable.role, "member"))
        .returning({ id: usersTable.id });

      const results = { deleted: deletedRows.length, created: 0, errors: [] as string[] };

      for (const row of rows) {
        const name = String(row.name ?? row["الاسم"] ?? "").trim();
        const rawPhone = String(row.phone ?? row["رقم الهاتف"] ?? row["الهاتف"] ?? "").trim();
        const phone = normalizePhone(rawPhone);
        const rawRole = String(row.role ?? row["الدور"] ?? "member").toLowerCase();
        const role: "admin" | "member" = rawRole === "admin" ? "admin" : "member";
        const category = String(row.category ?? "normal").toLowerCase();
        const validCategory = ["normal", "vip", "trial"].includes(category) ? category : "normal";
        const membershipNum = row.membershipNumber
          ? String(row.membershipNumber).trim()
          : null;

        if (!name || !phone) {
          results.errors.push(`صف مفقود البيانات: الاسم="${name}" الهاتف="${rawPhone}"`);
          continue;
        }

        try {
          // If the SQLite row already has a bcrypt hash, reuse it directly
          let hashed: string;
          const existingHash = row.passwordHash ?? row.password_hash;
          if (typeof existingHash === "string" && existingHash.startsWith("$2")) {
            hashed = existingHash;
          } else {
            const rawPassword = String(
              row.password ?? row["كلمة المرور"] ?? randomBytes(12).toString("base64url"),
            );
            const password = rawPassword.length > 72 ? rawPassword.slice(0, 72) : rawPassword;
            hashed = await bcrypt.hash(password, BCRYPT_COST);
          }

          await db.insert(usersTable).values({
            id: randomUUID(),
            name,
            phone,
            passwordHash: hashed,
            role,
            category: validCategory,
            membershipNumber: membershipNum,
          });
          results.created++;
        } catch (rowErr) {
          const msg = rowErr instanceof Error ? rowErr.message : "خطأ غير معروف";
          logger.error({ err: rowErr, name, phone }, "SQLite member import row failed");
          results.errors.push(`خطأ في إضافة ${name} (${phone}): ${msg}`);
        }
      }

      res.json({
        message: `تم الاستيراد: حذف ${results.deleted} عضو قديم، إضافة ${results.created} عضو جديد، ${results.errors.length} خطأ`,
        ...results,
      });
    } catch (err) {
      logger.error({ err }, "SQLite members import failed");
      res.status(500).json({
        error: "خطأ في الاستيراد",
        message: "حدث خطأ غير متوقع أثناء استيراد الأعضاء من SQLite",
      });
    } finally {
      if (filePath) {
        try {
          unlinkSync(filePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  },
);

export default router;
