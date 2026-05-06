import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),

  intId: integer("int_id").notNull().unique().default(sql`nextval('bank_accounts_int_id_seq')`),

  bankName: text("bank_name").notNull(),

  iban: text("iban").notNull(),

  accountHolderName: text("account_holder_name").notNull(),

  accountNumber: text("account_number"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const insertBankAccountSchema = (createInsertSchema(bankAccountsTable) as z.ZodObject<any>).omit({
  id: true,
  intId: true,
  createdAt: true,
});

export type InsertBankAccount = Omit<typeof bankAccountsTable.$inferInsert, "id" | "intId" | "createdAt">;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
