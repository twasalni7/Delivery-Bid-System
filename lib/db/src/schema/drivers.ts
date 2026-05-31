import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const driverStatusEnum = pgEnum("driver_status", [
  "ACTIVE",
  "BLOCKED",
  "DELETED",
]);

export const driversTable = pgTable(
  "drivers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    mobile: text("mobile").notNull(),
    loginCode: text("login_code").notNull(),
    passwordHash: text("password_hash"), // nullable for backward compatibility
    requiresPasswordReset: integer("requires_password_reset").notNull().default(0), // 0 = false, 1 = true (SQLite compatibility)
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
    carType: text("car_type"),
    carYear: text("car_year"),
    city: text("city"),
    nationality: text("nationality"),
    age: integer("age"),
    nationalId: text("national_id"),
    status: driverStatusEnum("status").notNull().default("ACTIVE"),
    warningCount: integer("warning_count").notNull().default(0),
    pushSubscription: text("push_subscription"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    mobileUniqueIdx: uniqueIndex("drivers_mobile_unique").on(table.mobile),
    loginCodeUniqueIdx: uniqueIndex("drivers_login_code_unique").on(
      table.loginCode
    ),
  })
);

export const insertDriverSchema = createInsertSchema(driversTable).omit({
  id: true,
  createdAt: true,
  status: true,
  warningCount: true,
  deletedAt: true,
});

export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
