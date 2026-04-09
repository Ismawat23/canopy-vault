import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, vaultsTable, transactionsTable, walletsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetVaultDistributionResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [vaults, wallets] = await Promise.all([
    db.select().from(vaultsTable),
    db.select().from(walletsTable),
  ]);

  const now = new Date();
  let totalValueLocked = 0;
  let activeCount = 0;
  let maturedCount = 0;
  let totalRewards = 0;
  let totalLockDays = 0;
  const chainSet = new Set<string>();

  for (const v of vaults) {
    const status =
      v.status === "withdrawn"
        ? "withdrawn"
        : now >= v.maturesAt
          ? "matured"
          : "active";

    if (status === "active") {
      activeCount++;
      totalValueLocked += parseFloat(v.amount);
      const daysElapsed = (now.getTime() - v.depositedAt.getTime()) / (1000 * 60 * 60 * 24);
      const annualRate = parseFloat(v.rewardRate) / 100;
      totalRewards += parseFloat(v.amount) * annualRate * (daysElapsed / 365);
    } else if (status === "matured") {
      maturedCount++;
      totalValueLocked += parseFloat(v.amount);
      const daysElapsed = (now.getTime() - v.depositedAt.getTime()) / (1000 * 60 * 60 * 24);
      const annualRate = parseFloat(v.rewardRate) / 100;
      totalRewards += parseFloat(v.amount) * annualRate * (daysElapsed / 365);
    } else {
      totalRewards += parseFloat(v.earnedRewards);
    }
    totalLockDays += v.lockDays;
    chainSet.add(v.chain);
  }

  const summary = {
    totalValueLocked: totalValueLocked.toFixed(2),
    activeVaults: activeCount,
    totalRewardsEarned: totalRewards.toFixed(6),
    maturedVaults: maturedCount,
    avgLockPeriod: vaults.length > 0 ? Math.round(totalLockDays / vaults.length) : 0,
    totalDeposits: vaults.length,
    totalChains: chainSet.size,
    totalWallets: wallets.length,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/vault-distribution", async (_req, res): Promise<void> => {
  const vaults = await db.select().from(vaultsTable);

  const buckets: Record<string, { count: number; totalValue: number }> = {
    "30 days": { count: 0, totalValue: 0 },
    "90 days": { count: 0, totalValue: 0 },
    "180 days": { count: 0, totalValue: 0 },
    "365 days": { count: 0, totalValue: 0 },
    "365+ days": { count: 0, totalValue: 0 },
  };

  for (const v of vaults) {
    let bucket: string;
    if (v.lockDays <= 30) bucket = "30 days";
    else if (v.lockDays <= 90) bucket = "90 days";
    else if (v.lockDays <= 180) bucket = "180 days";
    else if (v.lockDays <= 365) bucket = "365 days";
    else bucket = "365+ days";

    buckets[bucket].count++;
    buckets[bucket].totalValue += parseFloat(v.amount);
  }

  const distribution = Object.entries(buckets).map(([lockPeriod, data]) => ({
    lockPeriod,
    count: data.count,
    totalValue: data.totalValue.toFixed(2),
  }));

  res.json(GetVaultDistributionResponse.parse(distribution));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 10;

  const transactions = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      vaultName: vaultsTable.name,
      tokenSymbol: transactionsTable.tokenSymbol,
      amount: transactionsTable.amount,
      timestamp: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .innerJoin(vaultsTable, sql`${transactionsTable.vaultId} = ${vaultsTable.id}`)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  res.json(GetRecentActivityResponse.parse(transactions));
});

export default router;
