import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { driversTable } from "./drivers";

/**
 * Transaction types:
 *  fee    — platform bid fee deducted when driver accepts a request
 *  credit — balance top-up approved by admin
 *  debit  — manual balance deduction by admin
 */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "fee",
  "credit",
  "debit",
]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
