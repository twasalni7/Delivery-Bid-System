import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { requestsTable } from "./requests";

export const senderRoleEnum = ["client", "driver", "admin"] as const;

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requestsTable.id, { onDelete: "cascade" }),
  senderRole: text("sender_role")
    .notNull()
    .$type<"client" | "driver" | "admin">(),
  senderId: integer("sender_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
