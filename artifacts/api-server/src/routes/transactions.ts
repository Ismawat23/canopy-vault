import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
} from "@workspace/api-zod/generated";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/transactions", async (req, res): Promise<void> => {
  const params = ListTransactionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 20;
  const offset = params.data.offset ?? 0;
  const type = params.data.type ?? "all";

  let query = db
    .select()
    .from(transactionsTable)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  if (type !== "all") {
    query = db
      .select()
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = ${type}`)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const transactions = await query;
  res.json(ListTransactionsResponse.parse(transactions));
});

export default router;
