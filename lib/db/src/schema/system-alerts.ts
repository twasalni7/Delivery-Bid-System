import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const systemAlertsTable = pgTable("system_alerts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("warning"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SystemAlert = typeof systemAlertsTable.$inferSelect;
