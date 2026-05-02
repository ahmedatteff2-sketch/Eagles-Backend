import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const trainingProgramsTable = pgTable("training_programs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainingWeeksTable = pgTable("training_weeks", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => trainingProgramsTable.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
});

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  videoUrl: text("video_url"),
  setsRequired: integer("sets_required").notNull().default(3),
  repsMin: integer("reps_min").notNull(),
  repsMax: integer("reps_max").notNull(),
  weekId: integer("week_id").notNull().references(() => trainingWeeksTable.id, { onDelete: "cascade" }),
});

export const insertTrainingProgramSchema = createInsertSchema(trainingProgramsTable).omit({ id: true, createdAt: true });
export const insertTrainingWeekSchema = createInsertSchema(trainingWeeksTable).omit({ id: true });
export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true });

export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;
export type InsertTrainingWeek = z.infer<typeof insertTrainingWeekSchema>;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type TrainingProgram = typeof trainingProgramsTable.$inferSelect;
export type TrainingWeek = typeof trainingWeeksTable.$inferSelect;
export type Exercise = typeof exercisesTable.$inferSelect;
