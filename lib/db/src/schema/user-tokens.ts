import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const userTokensTable = pgTable("user_tokens", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("user_tokens_user_id_expires_at_idx").on(t.userId, t.expiresAt),
]);
