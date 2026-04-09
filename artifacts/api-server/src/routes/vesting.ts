import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vestingSchedulesTable } from "@workspace/db";
import {
  ListVestingSchedulesQueryParams,
  ListVestingSchedulesResponse,
  CreateVestingScheduleBody,
  GetVestingScheduleParams,
  GetVestingScheduleResponse,
  ClaimVestingParams,
  ClaimVestingResponse,
} from "@workspace/api-zod/generated";

const router: IRouter = Router();

function computeClaimable(
  totalAmount: string,
  releasedAmount: string,
  cliffDate: Date,
  endDate: Date,
  startDate: Date
): string {
  const now = new Date();
  if (now < cliffDate) return "0";
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = Math.min(now.getTime() - startDate.getTime(), totalDuration);
  const vestedFraction = elapsed / totalDuration;
  const vestedAmount = parseFloat(totalAmount) * vestedFraction;
  const claimable = Math.max(0, vestedAmount - parseFloat(releasedAmount));
  return claimable.toFixed(6);
}

function enrichSchedule(s: typeof vestingSchedulesTable.$inferSelect) {
  const claimableAmount = computeClaimable(
    s.totalAmount,
    s.releasedAmount,
    s.cliffDate,
    s.endDate,
    s.startDate
  );
  const now = new Date();
  const status = parseFloat(s.releasedAmount) >= parseFloat(s.totalAmount) ? "completed" : "active";
  return { ...s, claimableAmount, status };
}

router.get("/vesting", async (req, res): Promise<void> => {
  const params = ListVestingSchedulesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const schedules = await db.select().from(vestingSchedulesTable);
  const enriched = schedules.map(enrichSchedule);
  const status = params.data.status ?? "all";
  const filtered = status === "all" ? enriched : enriched.filter((s) => s.status === status);

  res.json(ListVestingSchedulesResponse.parse(filtered));
});

router.post("/vesting", async (req, res): Promise<void> => {
  const parsed = CreateVestingScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cliffDays, vestingDays, ...rest } = parsed.data;
  const now = new Date();
  const cliffDate = new Date(now.getTime() + cliffDays * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + vestingDays * 24 * 60 * 60 * 1000);

  const [schedule] = await db
    .insert(vestingSchedulesTable)
    .values({
      ...rest,
      cliffDays,
      vestingDays,
      cliffDate,
      endDate,
    })
    .returning();

  const enriched = enrichSchedule(schedule);
  res.status(201).json(GetVestingScheduleResponse.parse(enriched));
});

router.get("/vesting/:id", async (req, res): Promise<void> => {
  const params = GetVestingScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [schedule] = await db
    .select()
    .from(vestingSchedulesTable)
    .where(eq(vestingSchedulesTable.id, params.data.id));

  if (!schedule) {
    res.status(404).json({ error: "Vesting schedule not found" });
    return;
  }

  res.json(GetVestingScheduleResponse.parse(enrichSchedule(schedule)));
});

router.post("/vesting/:id/claim", async (req, res): Promise<void> => {
  const params = ClaimVestingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [schedule] = await db
    .select()
    .from(vestingSchedulesTable)
    .where(eq(vestingSchedulesTable.id, params.data.id));

  if (!schedule) {
    res.status(404).json({ error: "Vesting schedule not found" });
    return;
  }

  const claimable = computeClaimable(
    schedule.totalAmount,
    schedule.releasedAmount,
    schedule.cliffDate,
    schedule.endDate,
    schedule.startDate
  );

  if (parseFloat(claimable) <= 0) {
    res.status(400).json({ error: "No tokens available to claim" });
    return;
  }

  const newReleased = (parseFloat(schedule.releasedAmount) + parseFloat(claimable)).toFixed(6);
  const newStatus =
    parseFloat(newReleased) >= parseFloat(schedule.totalAmount) ? "completed" : "active";

  const [updated] = await db
    .update(vestingSchedulesTable)
    .set({ releasedAmount: newReleased, status: newStatus })
    .where(eq(vestingSchedulesTable.id, params.data.id))
    .returning();

  const enriched = enrichSchedule(updated);
  res.json(ClaimVestingResponse.parse(enriched));
});

export default router;
