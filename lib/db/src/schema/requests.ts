import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driversTable } from "./drivers";
import { clientsTable } from "./clients";

export const requestStatusEnum = pgEnum("request_status", [
  "OPEN",
  "SELECTED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "FROZEN",
]);

export const clientTypeEnum = pgEnum("client_type", [
  "موظفات",
  "طلاب",
  "مدارس",
  "جامعات",
  "معلمات",
  "غيره",
]);

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id),
  clientType: clientTypeEnum("client_type").notNull().default("غيره"),
  homeLocation: text("home_location").notNull(),
  workLocation: text("work_location").notNull(),
  additionalLocations: jsonb("additional_locations").$type<
    { type: "pickup" | "dropoff"; address: string }[]
  >(),
  shifts: jsonb("shifts").$type<
    { label?: string; goTime: string; returnTime?: string }[]
  >(),
  phone: text("phone").notNull(),
  numberOfPeople: integer("number_of_people").notNull().default(1),
  workingDaysPerWeek: integer("working_days_per_week").notNull().default(5),
  numberOfShifts: integer("number_of_shifts").notNull().default(1),
  morningTime: text("morning_time").notNull(),
  eveningTime: text("evening_time"),
  notes: text("notes"),
  monthlyPrice: real("monthly_price").notNull().default(0),
  status: requestStatusEnum("status").notNull().default("OPEN"),
  selectedDriverId: integer("selected_driver_id").references(
    () => driversTable.id
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  selectedDriverId: true,
  clientId: true,
});

export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;
