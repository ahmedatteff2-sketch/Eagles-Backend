import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/**
 * Append-only audit trail of admin/trainer write actions.
 *
 * Rows are intentionally NOT cascade-deleted with the actor: we want a
 * historical record even after the operator's user row is removed. For the
 * same reason this table has no UPDATE / DELETE endpoints in the API.
 */
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  // Nullable: anonymous / pre-auth events (e.g. failed logins) have no actor.
  actorId: text("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  actorName: text("actor_name"),
  // Free-form action label, e.g. "user.create", "subscription.assign",
  // "auth.login.failed". Use a "<resource>.<verb>" convention.
  action: text("action").notNull(),
  // What was acted upon. For requests with a `:id` param the middleware
  // populates `targetType` from the URL path and `targetId` from the param.
  targetType: text("target_type"),
  targetId: text("target_id"),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  // Sanitized request body / query metadata. Sensitive fields (password,
  // token, secret) are stripped before persisting.
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
