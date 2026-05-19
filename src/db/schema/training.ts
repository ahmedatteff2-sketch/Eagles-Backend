import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

// ── Exercise library ────────────────────────────────────────────────────────
export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  videoUrl: text("video_url"),
  targetMuscle: text("target_muscle").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Workout templates ───────────────────────────────────────────────────────
// `createdByUserId` partitions templates into two flavours:
//   - NULL          → global / admin-curated template (the admin library)
//   - <userId>      → personal template owned by that member (or trainer)
//
// Admin-facing `GET /api/workout-templates` filters to NULL, so the admin
// library never gets polluted with members' personal workouts. Members get
// their own templates back via `GET /api/my-workouts` along with anything
// admin assigned to them. RBAC for writes (`POST/PUT/DELETE`) keys off this
// column too — admins can edit anything, members can only edit rows they own.
export const workoutTemplatesTable = pgTable("workout_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  daysCount: integer("days_count").notNull().default(1),
  daysPerWeek: integer("days_per_week").notNull().default(4),
  dayNames: text("day_names"),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Exercises inside a template (with sets/reps) ────────────────────────────
export const workoutTemplateExercisesTable = pgTable("workout_template_exercises", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => workoutTemplatesTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercisesTable.id, { onDelete: "cascade" }),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  dayNumber: integer("day_number").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  restSeconds: integer("rest_seconds").default(90),
});

// ── Assign a template to a member ───────────────────────────────────────────
export const memberWorkoutAssignmentsTable = pgTable("member_workout_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => workoutTemplatesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

// ── Zod / TS helpers ────────────────────────────────────────────────────────
export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true, createdAt: true });
export const insertWorkoutTemplateSchema = createInsertSchema(workoutTemplatesTable).omit({
  id: true,
  createdAt: true,
});
export const insertWorkoutTemplateExerciseSchema = createInsertSchema(workoutTemplateExercisesTable).omit({
  id: true,
});
export const insertMemberWorkoutAssignmentSchema = createInsertSchema(memberWorkoutAssignmentsTable).omit({
  id: true,
  assignedAt: true,
});

export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplatesTable.$inferSelect;
export type WorkoutTemplateExercise = typeof workoutTemplateExercisesTable.$inferSelect;
export type MemberWorkoutAssignment = typeof memberWorkoutAssignmentsTable.$inferSelect;
