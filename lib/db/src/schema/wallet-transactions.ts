import {
  pgTable,
  serial,
  integer,
  numeric,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { driversTable } from "./drivers";

export const walletTransactionStatusEnum = pgEnum(
  "wallet_transaction_status",
  ["pending", "approved", "rejected"]
);

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  receiptUrl: text("receipt_url"),
  status: walletTransactionStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(
  walletTransactionsTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

export type InsertWalletTransaction = z.infer<
  typeof insertWalletTransactionSchema
>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
