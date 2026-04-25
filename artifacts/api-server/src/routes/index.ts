import { Router, type IRouter } from "express";
import healthRouter from "./health";
import driversRouter from "./drivers";
import requestsRouter from "./requests";
import offersRouter from "./offers";
import adminRouter from "./admin";
import authRouter from "./auth";
import supportTicketsRouter from "./support-tickets";
import notificationsRouter from "./notifications";
import bankAccountsRouter from "./bank-accounts";
import walletTransactionsRouter from "./wallet-transactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/drivers", driversRouter);
router.use("/requests", requestsRouter);
router.use("/offers", offersRouter);
router.use("/admin", adminRouter);
router.use("/support-tickets", supportTicketsRouter);
router.use("/notifications", notificationsRouter);
router.use("/bank-accounts", bankAccountsRouter);
router.use("/wallet-transactions", walletTransactionsRouter);

export default router;
