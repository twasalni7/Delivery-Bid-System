import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userRole: text("user_role").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  relatedId: integer("related_id"),
  url: text("url"),
  actionType: text("action_type"),
  actionLabel: text("action_label"),
  actionPayload: jsonb("action_payload"),
  channel: text("channel").notNull().default("in_app"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  deliveryError: text("delivery_error"),
  provider: text("provider"),
  providerResponse: jsonb("provider_response"),
  deliveredAt: timestamp("delivered_at"),
  clickedAt: timestamp("clicked_at"),
  interactedAt: timestamp("interacted_at"),
  interactionSource: text("interaction_source"),
  interactionType: text("interaction_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Speeds up "unread notifications for a user" queries
  index("notifications_user_read_idx").on(t.userId, t.userRole, t.isRead),
  // Speeds up "recent notifications for a user" queries (bell, center)
  index("notifications_user_created_idx").on(t.userId, t.userRole, t.createdAt),
]);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
