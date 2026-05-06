import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  pushSubscription: text("push_subscription"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const insertClientSchema = (createInsertSchema(clientsTable) as z.ZodObject<any>).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = Omit<typeof clientsTable.$inferInsert, "id" | "createdAt">;
export type Client = typeof clientsTable.$inferSelect;
