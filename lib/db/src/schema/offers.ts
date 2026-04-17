import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driversTable } from "./drivers";
import { requestsTable } from "./requests";

export const offersTable = pgTable("offers", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id),
  requestId: integer("request_id")
    .notNull()
    .references(() => requestsTable.id),
  price: real("price").notNull(),
  carType: text("car_type").notNull(),
  nationality: text("nationality").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOfferSchema = createInsertSchema(offersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offersTable.$inferSelect;
