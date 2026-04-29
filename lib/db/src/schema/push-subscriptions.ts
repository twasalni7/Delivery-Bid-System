import { pgTable, serial, integer, jsonb } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subscriptionData: jsonb("subscription_data").notNull(),
});

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptionsTable.$inferInsert;
