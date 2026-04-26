import { Router } from "express";
import { db } from "@workspace/db";
import { bankAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// GET /api/bank-accounts — accessible to all authenticated users (drivers see payment details)
router.get("/", requireAuth(), async (_req, res) => {
  try {
    const accounts = await db
      .select()
      .from(bankAccountsTable)
      .where(eq(bankAccountsTable.isActive, true))
      .orderBy(bankAccountsTable.createdAt);
    res.json(accounts);
  } catch (err) {
    logger.error({ err }, "bank-accounts GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Admin-only routes
router.use(requireAuth("admin"));

router.get("/all", async (_req, res) => {
  try {
    const accounts = await db
      .select()
      .from(bankAccountsTable)
      .orderBy(bankAccountsTable.createdAt);
    res.json(accounts);
  } catch (err) {
    logger.error({ err }, "bank-accounts GET /all error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/", async (req, res) => {
  const { bankName, iban, accountHolderName } = req.body ?? {};
  if (!bankName || !iban || !accountHolderName) {
    res.status(400).json({ error: "يرجى إدخال اسم البنك والـ IBAN واسم صاحب الحساب" });
    return;
  }
  try {
    const [account] = await db
      .insert(bankAccountsTable)
      .values({ bankName, iban, accountHolderName })
      .returning();
    res.status(201).json(account);
  } catch (err) {
    logger.error({ err }, "bank-accounts POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { bankName, iban, accountHolderName, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (bankName !== undefined) updates.bankName = bankName;
  if (iban !== undefined) updates.iban = iban;
  if (accountHolderName !== undefined) updates.accountHolderName = accountHolderName;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }
  try {
    const [updated] = await db
      .update(bankAccountsTable)
      .set(updates)
      .where(eq(bankAccountsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "bank-accounts PATCH /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const deleted = await db
      .delete(bankAccountsTable)
      .where(eq(bankAccountsTable.id, id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }
    res.json({ message: "تم حذف الحساب" });
  } catch (err) {
    logger.error({ err }, "bank-accounts DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
