import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  loginCode: text("login_code").notNull().unique(),
  pushSubscription: text("push_subscription"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const insertAdminSchema = (createInsertSchema(adminsTable) as z.ZodObject<any>).omit({
  id: true,
  createdAt: true,
});

export type InsertAdmin = Omit<typeof adminsTable.$inferInsert, "id" | "createdAt">;
export type Admin = typeof adminsTable.$inferSelect;
