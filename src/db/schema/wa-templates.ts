import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const waTemplatesTable = pgTable("wa_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWaTemplateSchema = createInsertSchema(waTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWaTemplate = z.infer<typeof insertWaTemplateSchema>;
export type WaTemplate = typeof waTemplatesTable.$inferSelect;
