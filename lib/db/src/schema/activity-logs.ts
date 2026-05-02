import { pgTable, bigserial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const activityLogsTable = pgTable("activity_logs", {
  id:        bigserial("id", { mode: "number" }).primaryKey(),
  actorId:   integer("actor_id"),
  actorRole: text("actor_role").notNull().default("system"),
  action:    text("action").notNull(),
  entity:    text("entity").notNull(),
  entityId:  integer("entity_id"),
  metadata:  jsonb("metadata").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type InsertActivityLog = typeof activityLogsTable.$inferInsert;
