import { pgTable, serial, integer, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { exercisesTable } from "./training";

export const exerciseLogsTable = pgTable("exercise_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull(),
  date: date("date").notNull(),
});

export const bodyStatsTable = pgTable("body_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
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

export const insertExerciseLogSchema = createInsertSchema(exerciseLogsTable).omit({ id: true });
export const insertBodyStatSchema = createInsertSchema(bodyStatsTable).omit({ id: true });
export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true });

export type InsertExerciseLog = z.infer<typeof insertExerciseLogSchema>;
export type InsertBodyStat = z.infer<typeof insertBodyStatSchema>;
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type ExerciseLog = typeof exerciseLogsTable.$inferSelect;
export type BodyStat = typeof bodyStatsTable.$inferSelect;
export type Checkin = typeof checkinsTable.$inferSelect;
