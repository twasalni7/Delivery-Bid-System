import { pgTable, text } from "drizzle-orm/pg-core";

export const appConfigTable = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AppConfig = typeof appConfigTable.$inferSelect;
