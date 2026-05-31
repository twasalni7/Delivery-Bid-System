import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => driversTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
