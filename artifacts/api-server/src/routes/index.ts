import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vaultsRouter from "./vaults";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import walletsRouter from "./wallets";
import vestingRouter from "./vesting";
import liquidityRouter from "./liquidity";
import portfolioRouter from "./portfolio";
import canopyRouter from "./canopy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vaultsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(walletsRouter);
router.use(vestingRouter);
router.use(liquidityRouter);
router.use(portfolioRouter);
router.use(canopyRouter);

export default router;
