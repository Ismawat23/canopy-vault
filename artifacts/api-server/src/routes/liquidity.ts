import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, liquidityLocksTable } from "@workspace/db";
import {
  ListLiquidityLocksQueryParams,
  ListLiquidityLocksResponse,
  CreateLiquidityLockBody,
  GetLiquidityLockParams,
  GetLiquidityLockResponse,
  UnlockLiquidityParams,
  UnlockLiquidityResponse,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

router.get("/liquidity", async (req, res): Promise<void> => {
  const params = ListLiquidityLocksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const locks = await db.select().from(liquidityLocksTable);
  const status = params.data.status ?? "all";
  const filtered = status === "all" ? locks : locks.filter((l) => l.status === status);

  res.json(ListLiquidityLocksResponse.parse(filtered));
});

router.post("/liquidity", async (req, res): Promise<void> => {
  const parsed = CreateLiquidityLockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lockDays, ...rest } = parsed.data;
  const now = new Date();
  const unlocksAt = new Date(now.getTime() + lockDays * 24 * 60 * 60 * 1000);

  const [lock] = await db
    .insert(liquidityLocksTable)
    .values({ ...rest, lockDays, unlocksAt })
    .returning();

  res.status(201).json(GetLiquidityLockResponse.parse(lock));
});

router.get("/liquidity/:id", async (req, res): Promise<void> => {
  const params = GetLiquidityLockParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lock] = await db
    .select()
    .from(liquidityLocksTable)
    .where(eq(liquidityLocksTable.id, params.data.id));

  if (!lock) {
    res.status(404).json({ error: "Liquidity lock not found" });
    return;
  }

  res.json(GetLiquidityLockResponse.parse(lock));
});

router.post("/liquidity/:id/unlock", async (req, res): Promise<void> => {
  const params = UnlockLiquidityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lock] = await db
    .select()
    .from(liquidityLocksTable)
    .where(eq(liquidityLocksTable.id, params.data.id));

  if (!lock) {
    res.status(404).json({ error: "Liquidity lock not found" });
    return;
  }

  if (lock.status === "unlocked") {
    res.status(400).json({ error: "Already unlocked" });
    return;
  }

  if (new Date() < lock.unlocksAt) {
    res.status(400).json({ error: "Lock period has not ended yet" });
    return;
  }

  const [updated] = await db
    .update(liquidityLocksTable)
    .set({ status: "unlocked", unlockedAt: new Date() })
    .where(eq(liquidityLocksTable.id, params.data.id))
    .returning();

  res.json(UnlockLiquidityResponse.parse(updated));
});

export default router;
