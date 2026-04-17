import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  balance: real("balance").notNull().default(0),
  carType: text("car_type"),
  nationality: text("nationality"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDriverSchema = createInsertSchema(driversTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
