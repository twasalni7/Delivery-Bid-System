import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

router.get("/", requireAuth(), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "min_monthly_price"));

    const suggested = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "suggested_price_per_person"));

    const minPrice = parseFloat(rows[0]?.value ?? "0") || 0;
    const suggestedPerPerson = parseFloat(suggested[0]?.value ?? "150") || 150;

    res.json({ minMonthlyPrice: minPrice, suggestedPricePerPerson: suggestedPerPerson });
  } catch (err) {
    logger.error({ err }, "pricing GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/", requireAuth("admin"), async (req, res) => {
  const { minMonthlyPrice, suggestedPricePerPerson } = req.body ?? {};

  try {
    if (minMonthlyPrice !== undefined) {
      const val = parseFloat(minMonthlyPrice);
      if (isNaN(val) || val < 0) {
        res.status(400).json({ error: "الحد الأدنى للسعر يجب أن يكون رقماً موجباً" });
        return;
      }
      await db
        .update(appConfigTable)
        .set({ value: String(val) })
        .where(eq(appConfigTable.key, "min_monthly_price"));
    }

    if (suggestedPricePerPerson !== undefined) {
      const val = parseFloat(suggestedPricePerPerson);
      if (isNaN(val) || val < 0) {
        res.status(400).json({ error: "السعر المقترح للشخص يجب أن يكون رقماً موجباً" });
        return;
      }
      await db
        .update(appConfigTable)
        .set({ value: String(val) })
        .where(eq(appConfigTable.key, "suggested_price_per_person"));
    }

    res.json({ message: "تم تحديث إعدادات التسعير" });
  } catch (err) {
    logger.error({ err }, "pricing PATCH / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
