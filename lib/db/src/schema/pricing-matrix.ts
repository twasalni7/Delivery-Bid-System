import { pgTable, serial, real, integer, text } from "drizzle-orm/pg-core";

export const pricingMatrixTable = pgTable("pricing_matrix", {
  id: serial("id").primaryKey(),
  distanceMinKm: real("distance_min_km").notNull(),
  distanceMaxKm: real("distance_max_km").notNull(),
  passengersMin: integer("passengers_min").notNull(),
  pricePerPerson: real("price_per_person").notNull(),
  /** Total route price in SAR (base price for 1 passenger).
   *  Dynamically dividing this by the actual passenger count gives
   *  the per-person price shown to the customer. */
  priceSar: real("price_sar"),
  /** Maximum passengers allowed for this distance tier. */
  passengersMax: integer("passengers_max").default(4),
  tripType: text("trip_type"),
  daysPerWeekMin: integer("days_per_week_min"),
  daysPerWeekMax: integer("days_per_week_max"),
});

export type PricingMatrix = typeof pricingMatrixTable.$inferSelect;
