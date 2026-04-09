import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vestingSchedulesTable = pgTable("vesting_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  beneficiary: text("beneficiary").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  totalAmount: text("total_amount").notNull(),
  releasedAmount: text("released_amount").notNull().default("0"),
  cliffDays: integer("cliff_days").notNull().default(0),
  vestingDays: integer("vesting_days").notNull(),
  status: text("status").notNull().default("active"),
  chain: text("chain").notNull(),
  contractAddress: text("contract_address"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  cliffDate: timestamp("cliff_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVestingScheduleSchema = createInsertSchema(vestingSchedulesTable).omit({
  id: true,
  createdAt: true,
  releasedAmount: true,
  status: true,
  startDate: true,
  cliffDate: true,
  endDate: true,
});
export type InsertVestingSchedule = z.infer<typeof insertVestingScheduleSchema>;
export type VestingSchedule = typeof vestingSchedulesTable.$inferSelect;
