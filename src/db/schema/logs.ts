import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";
import { exercisesTable } from "./training.js";

export const exerciseLogsTable = pgTable("exercise_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull(),
  date: date("date").notNull(),
});

export const bodyStatsTable = pgTable("body_stats", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }),
  bodyFat: numeric("body_fat", { precision: 5, scale: 2 }),
  dietNote: text("diet_note"),
  performanceNote: text("performance_note"),
});

export const checkinsTable = pgTable("CheckIn", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  method: text("method").notNull().default("MANUAL"),
});

export const progressPhotosTable = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  category: text("category").notNull().default("front"),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProgressPhotoSchema = createInsertSchema(progressPhotosTable).omit({ id: true, createdAt: true });
export type InsertProgressPhoto = z.infer<typeof insertProgressPhotoSchema>;
export type ProgressPhoto = typeof progressPhotosTable.$inferSelect;

// ── Water tracking ────────────────────────────────────────────────────────────
export const waterLogsTable = pgTable("water_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  glasses: integer("glasses").notNull().default(0),
  date: date("date").notNull(),
});

// ── Session ratings ───────────────────────────────────────────────────────────
export const sessionRatingsTable = pgTable("session_ratings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  note: text("note"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Chat messages ─────────────────────────────────────────────────────────────
export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: integer("read").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").notNull().default("general"),
  read: integer("read").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Meal plans ────────────────────────────────────────────────────────────────
export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mealPlanItemsTable = pgTable("meal_plan_items", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => mealPlansTable.id, { onDelete: "cascade" }),
  mealName: text("meal_name").notNull(),
  time: text("time"),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fats: integer("fats"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertExerciseLogSchema = createInsertSchema(exerciseLogsTable).omit({ id: true });
export const insertBodyStatSchema = createInsertSchema(bodyStatsTable).omit({ id: true });
export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true });

export type InsertExerciseLog = z.infer<typeof insertExerciseLogSchema>;
export type InsertBodyStat = z.infer<typeof insertBodyStatSchema>;
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type ExerciseLog = typeof exerciseLogsTable.$inferSelect;
export type BodyStat = typeof bodyStatsTable.$inferSelect;
export type Checkin = typeof checkinsTable.$inferSelect;
