import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  doublePrecision,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
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
  // clientId is intentionally nullable: admin-created requests may not have a client owner.
  // Enforce non-null in the API route layer when role === "client".
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
  homeLat: doublePrecision("home_lat"),
  homeLng: doublePrecision("home_lng"),
  destLat: doublePrecision("dest_lat"),
  destLng: doublePrecision("dest_lng"),
  distanceKm: doublePrecision("distance_km"),
  needsAdminReview: boolean("needs_admin_review").notNull().default(false),
  monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull().default("0"),
  status: requestStatusEnum("status").notNull().default("OPEN"),
  statusManuallySetByAdmin: boolean("status_manually_set_by_admin").notNull().default(false),
  selectedDriverId: integer("selected_driver_id").references(
    () => driversTable.id
  ),
  createdBy: text("created_by").notNull().default("client"),
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

