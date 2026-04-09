import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vaultsTable } from "./vaults";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  vaultId: integer("vault_id").notNull().references(() => vaultsTable.id),
  type: text("type").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: text("amount").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
