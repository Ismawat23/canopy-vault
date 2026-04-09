import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const liquidityLocksTable = pgTable("liquidity_locks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tokenPair: text("token_pair").notNull(),
  dex: text("dex").notNull(),
  chain: text("chain").notNull(),
  lpTokenAmount: text("lp_token_amount").notNull(),
  lockDays: integer("lock_days").notNull(),
  status: text("status").notNull().default("locked"),
  contractAddress: text("contract_address"),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  unlocksAt: timestamp("unlocks_at", { withTimezone: true }).notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLiquidityLockSchema = createInsertSchema(liquidityLocksTable).omit({
  id: true,
  createdAt: true,
  status: true,
  lockedAt: true,
  unlocksAt: true,
});
export type InsertLiquidityLock = z.infer<typeof insertLiquidityLockSchema>;
export type LiquidityLock = typeof liquidityLocksTable.$inferSelect;
