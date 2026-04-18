import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { driversTable } from "./drivers";
import { requestsTable } from "./requests";

export const ticketTypeEnum = pgEnum("ticket_type", [
  "تأخير",
  "دفع",
  "إلغاء",
  "أخرى",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id),
  driverId: integer("driver_id").references(() => driversTable.id),
  requestId: integer("request_id").references(() => requestsTable.id),
  type: ticketTypeEnum("type").notNull(),
  message: text("message").notNull(),
  status: ticketStatusEnum("status").notNull().default("OPEN"),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  adminReply: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
