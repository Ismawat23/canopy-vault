import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  address: text("address").notNull(),
  chain: text("chain").notNull(),
  balance: text("balance").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type WalletRecord = typeof walletsTable.$inferSelect;
