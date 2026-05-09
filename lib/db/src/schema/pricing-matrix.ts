import { pgTable, serial, numeric, integer, text } from "drizzle-orm/pg-core";

export const pricingMatrixTable = pgTable("pricing_matrix", {
  id: serial("id").primaryKey(),
  distanceMinKm: numeric("distance_min_km", { precision: 8, scale: 2 }).notNull(),
  distanceMaxKm: numeric("distance_max_km", { precision: 8, scale: 2 }).notNull(),
  passengersMin: integer("passengers_min").notNull(),
  /** Per-person price in SAR */
  pricePerPerson: numeric("price_per_person", { precision: 10, scale: 2 }).notNull(),
  /** Total route price in SAR (base price for 1 passenger).
   *  Dynamically dividing this by the actual passenger count gives
   *  the per-person price shown to the customer. */
  priceSar: numeric("price_sar", { precision: 10, scale: 2 }),
  /** Maximum passengers allowed for this distance tier. */
  passengersMax: integer("passengers_max").default(4),
  tripType: text("trip_type"),
  daysPerWeekMin: integer("days_per_week_min"),
  daysPerWeekMax: integer("days_per_week_max"),
});

export type PricingMatrix = typeof pricingMatrixTable.$inferSelect;
