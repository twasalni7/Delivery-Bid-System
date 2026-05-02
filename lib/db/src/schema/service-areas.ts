import { pgTable, serial, text, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";

export const serviceAreasTable = pgTable("service_areas", {
  id:        serial("id").primaryKey(),
  city:      text("city").notNull(),
  district:  text("district"),
  lat:       doublePrecision("lat"),
  lng:       doublePrecision("lng"),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ServiceArea = typeof serviceAreasTable.$inferSelect;
export type InsertServiceArea = typeof serviceAreasTable.$inferInsert;
