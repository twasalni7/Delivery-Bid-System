import { pgTable, serial, real, integer } from "drizzle-orm/pg-core";

export const pricingMatrixTable = pgTable("pricing_matrix", {
  id: serial("id").primaryKey(),
  minKm: real("min_km").notNull(),
  maxKm: real("max_km").notNull(),
  numPassengers: integer("num_passengers").notNull(),
  pricePerPerson: real("price_per_person").notNull(),
  /** Total route price in SAR (base price for 1 passenger).
   *  Dynamically dividing this by the actual passenger count gives
   *  the per-person price shown to the customer. */
  priceSar: real("price_sar"),
  /** Maximum passengers allowed for this distance tier. */
  passengersMax: integer("passengers_max").default(4),
});

export type PricingMatrix = typeof pricingMatrixTable.$inferSelect;
