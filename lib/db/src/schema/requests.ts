import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driversTable } from "./drivers";

export const requestStatusEnum = pgEnum("request_status", [
  "OPEN",
  "SELECTED",
  "ACTIVE",
  "COMPLETED",
]);

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  homeLocation: text("home_location").notNull(),
  workLocation: text("work_location").notNull(),
  phone: text("phone").notNull(),
  numberOfPeople: integer("number_of_people").notNull().default(1),
  workingDaysPerWeek: integer("working_days_per_week").notNull().default(5),
  morningTime: text("morning_time").notNull(),
  eveningTime: text("evening_time").notNull(),
  status: requestStatusEnum("status").notNull().default("OPEN"),
  selectedDriverId: integer("selected_driver_id").references(
    () => driversTable.id
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  createdAt: true,
  status: true,
  selectedDriverId: true,
});

export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;
