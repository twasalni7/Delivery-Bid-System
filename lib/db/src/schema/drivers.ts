import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
    balance: real("balance").notNull().default(0),
    carType: text("car_type"),
    nationality: text("nationality"),
    age: integer("age"),
    nationalId: text("national_id"),
    status: driverStatusEnum("status").notNull().default("ACTIVE"),
    warningCount: integer("warning_count").notNull().default(0),
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
