import { pgTable, serial, text, pgEnum, time, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

export const scheduleTable = pgTable("schedule", {
  id: serial("id").primaryKey(),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  className: text("class_name").notNull(),
  trainerName: text("trainer_name"),
  capacity: integer("capacity"),
  location: text("location"),
});

export const insertScheduleSchema = createInsertSchema(scheduleTable).omit({ id: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof scheduleTable.$inferSelect;
