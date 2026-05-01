import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

const BID_FEE_KEY = "bid_fee";
export const DEFAULT_BID_FEE = 50;

/**
 * Returns the current bid fee from app_config.
 * Falls back to DEFAULT_BID_FEE if not set or on error.
 */
export async function getBidFee(): Promise<number> {
  try {
    const row = await db.query.appConfigTable.findFirst({
      where: eq(appConfigTable.key, BID_FEE_KEY),
    });
    if (row) {
      const fee = parseFloat(row.value);
      if (isFinite(fee) && fee > 0) return fee;
    }
  } catch {
    // Silent — fallback to default
  }
  return DEFAULT_BID_FEE;
}

// GET /api/pricing — returns current pricing config (admin only)
router.get("/", requireAuth("admin"), async (_req, res) => {
  try {
    const bidFee = await getBidFee();
    res.json({ bidFee });
  } catch (err) {
    logger.error({ err }, "pricing GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// PATCH /api/pricing — update bid fee (admin only)
router.patch("/", requireAuth("admin"), async (req, res) => {
  const { bidFee } = req.body ?? {};
  const fee = Number(bidFee);
  if (!isFinite(fee) || fee <= 0) {
    res.status(400).json({ error: "قيمة رسوم العرض غير صحيحة" });
    return;
  }
  try {
    await db
      .insert(appConfigTable)
      .values({ key: BID_FEE_KEY, value: String(fee) })
      .onConflictDoUpdate({
        target: appConfigTable.key,
        set: { value: String(fee) },
      });
    res.json({ bidFee: fee });
  } catch (err) {
    logger.error({ err }, "pricing PATCH / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
