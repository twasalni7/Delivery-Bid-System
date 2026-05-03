import { pgTable, serial, integer, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";
import { requestsTable } from "./requests";

export const requestStopsTable = pgTable("request_stops", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => requestsTable.id, { onDelete: "cascade" }),
  stopOrder: integer("stop_order").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  address: text("address").notNull(),
  stopType: text("stop_type").notNull().default("waypoint"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RequestStop = typeof requestStopsTable.$inferSelect;
