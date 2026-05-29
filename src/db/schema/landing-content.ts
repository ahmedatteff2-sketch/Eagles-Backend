import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { LandingContent } from "../../lib/landing-content.js";

// Singleton table: the landing CMS document always lives in the row with id = 1.
export const landingContentTable = pgTable("landing_content", {
  id: integer("id").primaryKey(),
  content: jsonb("content").$type<LandingContent>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LandingContentRow = typeof landingContentTable.$inferSelect;
