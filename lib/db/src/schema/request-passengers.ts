import {
  pgTable,
  serial,
  integer,
  doublePrecision,
  text,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { requestsTable } from "./requests";

export const requestPassengersTable = pgTable("request_passengers", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requestsTable.id, { onDelete: "cascade" }),
  passengerIndex: integer("passenger_index").notNull(),
  pickupLat: doublePrecision("pickup_lat"),
  pickupLng: doublePrecision("pickup_lng"),
  destinationLat: doublePrecision("destination_lat"),
  destinationLng: doublePrecision("destination_lng"),
  pickupAddress: text("pickup_address"),
  destinationAddress: text("destination_address"),
  workTime: text("work_time"),
  daysPerWeek: integer("days_per_week"),
  distanceKm: real("distance_km"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RequestPassenger = typeof requestPassengersTable.$inferSelect;
