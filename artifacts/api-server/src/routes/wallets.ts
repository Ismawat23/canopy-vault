import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, walletsTable } from "@workspace/db";
import {
  ListWalletsResponse,
  CreateWalletBody,
  DeleteWalletParams,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

router.get("/wallets", async (_req, res): Promise<void> => {
  const wallets = await db.select().from(walletsTable);
  res.json(ListWalletsResponse.parse(wallets));
});

router.post("/wallets", async (req, res): Promise<void> => {
  const parsed = CreateWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [wallet] = await db
    .insert(walletsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(wallet);
});

router.delete("/wallets/:id", async (req, res): Promise<void> => {
  const params = DeleteWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(walletsTable)
    .where(eq(walletsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
