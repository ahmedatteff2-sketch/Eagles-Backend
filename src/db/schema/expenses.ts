import { pgTable, serial, numeric, date, text, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "rent", "utilities", "salaries", "equipment", "maintenance", "marketing", "other"
]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  category: expenseCategoryEnum("category").notNull().default("other"),
  notes: text("notes"),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
