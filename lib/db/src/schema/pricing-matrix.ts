import { pgTable, serial, real, integer } from "drizzle-orm/pg-core";

export const pricingMatrixTable = pgTable("pricing_matrix", {
  id: serial("id").primaryKey(),
  minKm: real("min_km").notNull(),
  maxKm: real("max_km").notNull(),
  numPassengers: integer("num_passengers").notNull(),
  pricePerPerson: real("price_per_person").notNull(),
});

export type PricingMatrix = typeof pricingMatrixTable.$inferSelect;
