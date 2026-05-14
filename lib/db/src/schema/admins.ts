import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(), // Optional email for password-based auth
  password: text("password"), // Scrypt hashed password (replaces loginCode)
  loginCode: text("login_code").unique(), // Deprecated - kept for backward compatibility
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
