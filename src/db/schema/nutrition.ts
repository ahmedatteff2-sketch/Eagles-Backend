import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/**
 * Flexible-diet (IIFYM) tracking.
 *
 * `foods` is a curated catalog of common foods with their macros expressed
 * PER 100 GRAMS — the canonical reference values. Members pick a food and
 * enter a weight in grams; the server scales the macros (`per100 * grams/100`).
 *
 * `food_logs` stores each logged entry with its macros computed and frozen at
 * log time (denormalized). We snapshot the values rather than re-deriving from
 * `foods` on every read so a member's history stays stable even if a catalog
 * value is later corrected, and so custom (off-catalog) foods work the same way.
 */
export const foodsTable = pgTable("foods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  caloriesPer100g: numeric("calories_per_100g", { precision: 7, scale: 2 }).notNull(),
  proteinPer100g: numeric("protein_per_100g", { precision: 6, scale: 2 }).notNull(),
  carbsPer100g: numeric("carbs_per_100g", { precision: 6, scale: 2 }).notNull(),
  fatsPer100g: numeric("fats_per_100g", { precision: 6, scale: 2 }).notNull(),
});

export const foodLogsTable = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  foodName: text("food_name").notNull(),
  grams: numeric("grams", { precision: 7, scale: 1 }).notNull(),
  calories: numeric("calories", { precision: 7, scale: 1 }).notNull(),
  protein: numeric("protein", { precision: 6, scale: 1 }).notNull(),
  carbs: numeric("carbs", { precision: 6, scale: 1 }).notNull(),
  fats: numeric("fats", { precision: 6, scale: 1 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Food = typeof foodsTable.$inferSelect;
export type FoodLog = typeof foodLogsTable.$inferSelect;
