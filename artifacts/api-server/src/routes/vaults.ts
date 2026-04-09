import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, vaultsTable, transactionsTable } from "@workspace/db";
import {
  ListVaultsQueryParams,
  ListVaultsResponse,
  CreateVaultBody,
  GetVaultParams,
  GetVaultResponse,
  WithdrawVaultParams,
  WithdrawVaultResponse,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

function computeRewardRate(lockDays: number): string {
  if (lockDays <= 30) return "3.5";
  if (lockDays <= 90) return "5.2";
  if (lockDays <= 180) return "7.8";
  if (lockDays <= 365) return "10.5";
  return "14.0";
}

function computeEarnedRewards(amount: string, rewardRate: string, depositedAt: Date): string {
  const now = new Date();
  const daysElapsed = (now.getTime() - depositedAt.getTime()) / (1000 * 60 * 60 * 24);
  const annualRate = parseFloat(rewardRate) / 100;
  const earned = parseFloat(amount) * annualRate * (daysElapsed / 365);
  return earned.toFixed(6);
}

function checkVaultStatus(vault: { status: string; maturesAt: Date }): string {
  if (vault.status === "withdrawn") return "withdrawn";
  if (new Date() >= vault.maturesAt) return "matured";
  return "active";
}

router.get("/vaults", async (req, res): Promise<void> => {
  const params = ListVaultsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let vaults = await db
    .select()
    .from(vaultsTable)
    .orderBy(desc(vaultsTable.createdAt));

  const enriched = vaults.map((v) => ({
    ...v,
    status: checkVaultStatus(v),
    earnedRewards: computeEarnedRewards(v.amount, v.rewardRate, v.depositedAt),
  }));

  const status = params.data.status ?? "all";
  const filtered = status === "all" ? enriched : enriched.filter((v) => v.status === status);

  res.json(ListVaultsResponse.parse(filtered));
});

router.post("/vaults", async (req, res): Promise<void> => {
  const parsed = CreateVaultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, tokenSymbol, amount, lockDays } = parsed.data;
  const rewardRate = computeRewardRate(lockDays);
  const now = new Date();
  const maturesAt = new Date(now.getTime() + lockDays * 24 * 60 * 60 * 1000);
  const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

  const [vault] = await db
    .insert(vaultsTable)
    .values({
      name,
      tokenSymbol,
      amount,
      rewardRate,
      lockDays,
      maturesAt,
    })
    .returning();

  await db.insert(transactionsTable).values({
    vaultId: vault.id,
    type: "deposit",
    tokenSymbol,
    amount,
    txHash,
  });

  res.status(201).json(
    GetVaultResponse.parse({
      ...vault,
      earnedRewards: "0",
    })
  );
});

router.get("/vaults/:id", async (req, res): Promise<void> => {
  const params = GetVaultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vault] = await db
    .select()
    .from(vaultsTable)
    .where(eq(vaultsTable.id, params.data.id));

  if (!vault) {
    res.status(404).json({ error: "Vault not found" });
    return;
  }

  const enriched = {
    ...vault,
    status: checkVaultStatus(vault),
    earnedRewards: computeEarnedRewards(vault.amount, vault.rewardRate, vault.depositedAt),
  };

  res.json(GetVaultResponse.parse(enriched));
});

router.post("/vaults/:id/withdraw", async (req, res): Promise<void> => {
  const params = WithdrawVaultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vault] = await db
    .select()
    .from(vaultsTable)
    .where(eq(vaultsTable.id, params.data.id));

  if (!vault) {
    res.status(404).json({ error: "Vault not found" });
    return;
  }

  const currentStatus = checkVaultStatus(vault);
  if (currentStatus === "withdrawn") {
    res.status(400).json({ error: "Vault already withdrawn" });
    return;
  }
  if (currentStatus !== "matured") {
    res.status(400).json({ error: "Vault has not matured yet" });
    return;
  }

  const earnedRewards = computeEarnedRewards(vault.amount, vault.rewardRate, vault.depositedAt);
  const now = new Date();
  const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

  const [updated] = await db
    .update(vaultsTable)
    .set({
      status: "withdrawn",
      withdrawnAt: now,
      earnedRewards,
    })
    .where(eq(vaultsTable.id, params.data.id))
    .returning();

  const totalWithdrawal = (parseFloat(vault.amount) + parseFloat(earnedRewards)).toFixed(6);

  await db.insert(transactionsTable).values({
    vaultId: vault.id,
    type: "withdrawal",
    tokenSymbol: vault.tokenSymbol,
    amount: totalWithdrawal,
    txHash,
  });

  await db.insert(transactionsTable).values({
    vaultId: vault.id,
    type: "reward",
    tokenSymbol: vault.tokenSymbol,
    amount: earnedRewards,
    txHash: null,
  });

  res.json(
    WithdrawVaultResponse.parse({
      ...updated,
      earnedRewards,
      status: "withdrawn",
    })
  );
});

export default router;
