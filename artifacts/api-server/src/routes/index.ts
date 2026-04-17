import { Router, type IRouter } from "express";
import healthRouter from "./health";
import driversRouter from "./drivers";
import requestsRouter from "./requests";
import offersRouter from "./offers";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/drivers", driversRouter);
router.use("/requests", requestsRouter);
router.use("/offers", offersRouter);
router.use("/admin", adminRouter);

export default router;
