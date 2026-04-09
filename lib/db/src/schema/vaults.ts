import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultsTable = pgTable("vaults", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: text("amount").notNull(),
  rewardRate: text("reward_rate").notNull(),
  earnedRewards: text("earned_rewards").notNull().default("0"),
  lockDays: integer("lock_days").notNull(),
  status: text("status").notNull().default("active"),
  depositedAt: timestamp("deposited_at", { withTimezone: true }).notNull().defaultNow(),
  maturesAt: timestamp("matures_at", { withTimezone: true }).notNull(),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVaultSchema = createInsertSchema(vaultsTable).omit({
  id: true,
  createdAt: true,
  earnedRewards: true,
  status: true,
  depositedAt: true,
});
export type InsertVault = z.infer<typeof insertVaultSchema>;
export type Vault = typeof vaultsTable.$inferSelect;
