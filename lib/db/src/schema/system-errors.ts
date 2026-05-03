import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const systemErrorsTable = pgTable("system_errors", {
  id: serial("id").primaryKey(),
  errorType: text("error_type").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  page: text("page"),
  userId: integer("user_id"),
  userRole: text("user_role"),
  count: integer("count").notNull().default(1),
  severity: text("severity").notNull().default("error"),
  resolved: text("resolved").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemError = typeof systemErrorsTable.$inferSelect;
