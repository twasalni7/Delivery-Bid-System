import { pgTable, serial, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    userRole: text("user_role").notNull(),
    subscriptionData: jsonb("subscription_data").notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("push_subscriptions_user_role_unique").on(table.userId, table.userRole),
  })
);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptionsTable.$inferInsert;
