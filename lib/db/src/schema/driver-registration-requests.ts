import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { adminsTable } from "./admins";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const registrationRequestStatusEnum = pgEnum(
  "registration_request_status",
  ["PENDING", "APPROVED", "REJECTED"]
);

export const driverRegistrationRequestsTable = pgTable(
  "driver_registration_requests",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    mobile: text("mobile").notNull(),
    city: text("city").notNull(),
    carType: text("car_type").notNull(),
    carYear: text("car_year").notNull(),
    nationality: text("nationality").notNull(),
    nationalId: text("national_id").notNull(),
    age: integer("age").notNull(),
    status: registrationRequestStatusEnum("status")
      .notNull()
      .default("PENDING"),
    approvedBy: integer("approved_by").references(() => adminsTable.id),
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),
    createdDriverId: integer("created_driver_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const insertDriverRegistrationRequestSchema = createInsertSchema(
  driverRegistrationRequestsTable
).omit({
  id: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  rejectionReason: true,
  createdDriverId: true,
  createdAt: true,
});

export type DriverRegistrationRequest =
  typeof driverRegistrationRequestsTable.$inferSelect;
export type InsertDriverRegistrationRequest = z.infer<
  typeof insertDriverRegistrationRequestSchema
>;
