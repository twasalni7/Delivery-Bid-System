/**
 * system-errors.ts (updated schema)
 * أضفنا: method, route, ip, user_agent, environment, last_seen_at
 */

import {
  pgTable, serial, text, integer, boolean, timestamp,
} from "drizzle-orm/pg-core";

export const systemErrorsTable = pgTable("system_errors", {
  id:          serial("id").primaryKey(),
  errorType:   text("error_type").notNull(),
  message:     text("message").notNull(),
  stack:       text("stack"),
  page:        text("page"),              // legacy — kept for compatibility
  route:       text("route"),             // NEW: API route e.g. /api/requests
  method:      text("method"),            // NEW: GET / POST / PATCH …
  ip:          text("ip"),                // NEW: client IP
  userAgent:   text("user_agent"),        // NEW: browser / app UA string
  environment: text("environment"),       // NEW: production / development
  userId:      integer("user_id"),
  userRole:    text("user_role"),
  count:       integer("count").notNull().default(1),
  severity:    text("severity").notNull().default("error"),
  resolved:    boolean("resolved").notNull().default(false),
  lastSeenAt:  timestamp("last_seen_at"), // NEW: last occurrence time
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export type SystemError = typeof systemErrorsTable.$inferSelect;
