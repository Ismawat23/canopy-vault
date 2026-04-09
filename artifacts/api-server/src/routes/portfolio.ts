import { Router, type IRouter } from "express";
import { db, vaultsTable, vestingSchedulesTable, liquidityLocksTable, walletsTable } from "@workspace/db";
import {
  GetPortfolioSummaryResponse,
  GetPortfolioByChainResponse,
  GetPortfolioAllocationsResponse,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

function computeEarnedRewards(amount: string, rewardRate: string, depositedAt: Date): number {
  const now = new Date();
  const daysElapsed = (now.getTime() - depositedAt.getTime()) / (1000 * 60 * 60 * 24);
  const annualRate = parseFloat(rewardRate) / 100;
  return parseFloat(amount) * annualRate * (daysElapsed / 365);
}

function computeClaimable(totalAmount: string, releasedAmount: string, cliffDate: Date, endDate: Date, startDate: Date): number {
  const now = new Date();
  if (now < cliffDate) return 0;
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = Math.min(now.getTime() - startDate.getTime(), totalDuration);
  const vestedAmount = parseFloat(totalAmount) * (elapsed / totalDuration);
  return Math.max(0, vestedAmount - parseFloat(releasedAmount));
}

router.get("/portfolio/summary", async (_req, res): Promise<void> => {
  const [vaults, vestings, liquidityLocks, wallets] = await Promise.all([
    db.select().from(vaultsTable),
    db.select().from(vestingSchedulesTable),
    db.select().from(liquidityLocksTable),
    db.select().from(walletsTable),
  ]);

  let totalLocked = 0;
  let totalRewards = 0;
  const activeChainSet = new Set<string>();
  let activePositions = 0;

  const now = new Date();
  for (const v of vaults) {
    const status = v.status === "withdrawn" ? "withdrawn" : now >= v.maturesAt ? "matured" : "active";
    if (status !== "withdrawn") {
      totalLocked += parseFloat(v.amount);
      totalRewards += computeEarnedRewards(v.amount, v.rewardRate, v.depositedAt);
      activeChainSet.add(v.chain);
      if (status === "active") activePositions++;
    }
  }

  let totalVesting = 0;
  for (const v of vestings) {
    if (v.status !== "completed") {
      totalVesting += parseFloat(v.totalAmount) - parseFloat(v.releasedAmount);
      activeChainSet.add(v.chain);
      activePositions++;
    }
  }

  let totalLiquidity = 0;
  for (const l of liquidityLocks) {
    if (l.status === "locked") {
      totalLiquidity += parseFloat(l.lpTokenAmount);
      activeChainSet.add(l.chain);
      activePositions++;
    }
  }

  const totalValue = totalLocked + totalVesting + totalLiquidity + totalRewards;

  res.json(GetPortfolioSummaryResponse.parse({
    totalValue: totalValue.toFixed(2),
    totalLocked: totalLocked.toFixed(2),
    totalVesting: totalVesting.toFixed(2),
    totalLiquidity: totalLiquidity.toFixed(2),
    totalRewards: totalRewards.toFixed(6),
    activeChains: activeChainSet.size,
    connectedWallets: wallets.length,
    activePositions,
  }));
});

router.get("/portfolio/by-chain", async (_req, res): Promise<void> => {
  const [vaults, vestings, liquidityLocks] = await Promise.all([
    db.select().from(vaultsTable),
    db.select().from(vestingSchedulesTable),
    db.select().from(liquidityLocksTable),
  ]);

  const chainMap: Record<string, { totalValue: number; vaultCount: number; vestingCount: number; liquidityCount: number }> = {};

  const now = new Date();
  const ensureChain = (chain: string) => {
    if (!chainMap[chain]) chainMap[chain] = { totalValue: 0, vaultCount: 0, vestingCount: 0, liquidityCount: 0 };
  };

  for (const v of vaults) {
    const status = v.status === "withdrawn" ? "withdrawn" : now >= v.maturesAt ? "matured" : "active";
    if (status !== "withdrawn") {
      ensureChain(v.chain);
      chainMap[v.chain].totalValue += parseFloat(v.amount);
      chainMap[v.chain].vaultCount++;
    }
  }

  for (const v of vestings) {
    if (v.status !== "completed") {
      ensureChain(v.chain);
      chainMap[v.chain].totalValue += parseFloat(v.totalAmount) - parseFloat(v.releasedAmount);
      chainMap[v.chain].vestingCount++;
    }
  }

  for (const l of liquidityLocks) {
    if (l.status === "locked") {
      ensureChain(l.chain);
      chainMap[l.chain].totalValue += parseFloat(l.lpTokenAmount);
      chainMap[l.chain].liquidityCount++;
    }
  }

  const result = Object.entries(chainMap).map(([chain, data]) => ({
    chain,
    totalValue: data.totalValue.toFixed(2),
    vaultCount: data.vaultCount,
    vestingCount: data.vestingCount,
    liquidityCount: data.liquidityCount,
  }));

  res.json(GetPortfolioByChainResponse.parse(result));
});

router.get("/portfolio/allocations", async (_req, res): Promise<void> => {
  const [vaults, vestings] = await Promise.all([
    db.select().from(vaultsTable),
    db.select().from(vestingSchedulesTable),
  ]);

  const tokenMap: Record<string, { lockedInVaults: number; inVesting: number }> = {};

  const now = new Date();
  const ensureToken = (symbol: string) => {
    if (!tokenMap[symbol]) tokenMap[symbol] = { lockedInVaults: 0, inVesting: 0 };
  };

  for (const v of vaults) {
    const status = v.status === "withdrawn" ? "withdrawn" : now >= v.maturesAt ? "matured" : "active";
    if (status !== "withdrawn") {
      ensureToken(v.tokenSymbol);
      tokenMap[v.tokenSymbol].lockedInVaults += parseFloat(v.amount);
    }
  }

  for (const v of vestings) {
    if (v.status !== "completed") {
      ensureToken(v.tokenSymbol);
      tokenMap[v.tokenSymbol].inVesting += parseFloat(v.totalAmount) - parseFloat(v.releasedAmount);
    }
  }

  const entries = Object.entries(tokenMap);
  const totals = entries.map(([sym, data]) => ({
    symbol: sym,
    total: data.lockedInVaults + data.inVesting,
    lockedInVaults: data.lockedInVaults,
    inVesting: data.inVesting,
  }));
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);

  const result = totals.map((t) => ({
    tokenSymbol: t.symbol,
    totalAmount: t.total.toFixed(6),
    percentage: grandTotal > 0 ? Math.round((t.total / grandTotal) * 1000) / 10 : 0,
    lockedInVaults: t.lockedInVaults.toFixed(6),
    inVesting: t.inVesting.toFixed(6),
  }));

  res.json(GetPortfolioAllocationsResponse.parse(result));
});

export default router;
