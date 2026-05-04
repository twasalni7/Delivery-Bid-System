import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { driversTable } from "./drivers";
import { requestsTable } from "./requests";

export const offerStatusEnum = pgEnum("offer_status", [
  "PENDING",
  "SELECTED",
  "CANCELLED",
]);

export const offersTable = pgTable("offers", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id),
  requestId: integer("request_id")
    .notNull()
    .references(() => requestsTable.id),
  status: offerStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOfferSchema = createInsertSchema(offersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offersTable.$inferSelect;
