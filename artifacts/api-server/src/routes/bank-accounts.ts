import { Router } from "express";
import { db } from "@workspace/db";
import { bankAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { notifyAllAdmins } from "../lib/notify";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

async function findBankAccountByIntId(intId: number) {
  const byIntId = await db.query.bankAccountsTable.findFirst({
    where: eq(bankAccountsTable.intId, intId),
  });
  if (byIntId) return byIntId;

  return db.query.bankAccountsTable.findFirst({
    where: eq(bankAccountsTable.id, intId),
  });
}

/* =========================
   GET ACTIVE ACCOUNTS
========================= */
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

router.use(requireAuth("admin"));

/* =========================
   GET ALL (ADMIN)
========================= */
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

/* =========================
   CREATE ACCOUNT
========================= */
router.post("/", async (req, res) => {
  const { bankName, iban, accountHolderName, accountNumber } = req.body ?? {};

  if (!bankName || !iban || !accountHolderName) {
    res.status(400).json({ error: "يرجى إدخال اسم البنك والـ IBAN واسم صاحب الحساب" });
    return;
  }

  const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

  if (!IBAN_RE.test(String(iban).trim().toUpperCase().replace(/\s/g, ""))) {
    res.status(400).json({ error: "صيغة الـ IBAN غير صحيحة. مثال: SA0380000000608010167519" });
    return;
  }

  try {
    const [account] = await db
      .insert(bankAccountsTable)
      .values({
        bankName,
        iban,
        accountHolderName,
        accountNumber: accountNumber ?? null,
      })
      .returning();

    void notifyAllAdmins({
      title: "تم إضافة حساب بنكي جديد",
      message: `تمت إضافة حساب ${bankName} باسم ${accountHolderName}`,
      type: "system",
      relatedId: account.id,
      url: "/admin/settings",
    });

    res.status(201).json(account);
  } catch (err) {
    logger.error({ err }, "bank-accounts POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

/* =========================
   UPDATE ACCOUNT
========================= */
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { bankName, iban, accountHolderName, accountNumber, isActive } = req.body ?? {};

  const updates: Record<string, unknown> = {};

  if (bankName !== undefined) updates.bankName = bankName;
  if (iban !== undefined) updates.iban = iban;

  if (accountHolderName !== undefined) {
    updates.accountHolderName = accountHolderName;
  }

  if (accountNumber !== undefined) {
    updates.accountNumber = accountNumber ?? null;
  }

  if (isActive !== undefined) {
    updates.isActive = Boolean(isActive);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }

  try {
    const existing = await findBankAccountByIntId(id);

    if (!existing) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    const [updated] = await db
      .update(bankAccountsTable)
      .set(updates)
      .where(eq(bankAccountsTable.id, existing.id))
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

/* =========================
   DELETE ACCOUNT
========================= */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    const existing = await findBankAccountByIntId(id);

    if (!existing) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    const deleted = await db
      .delete(bankAccountsTable)
      .where(eq(bankAccountsTable.id, existing.id))
      .returning();

    if (!deleted.length) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    void notifyAllAdmins({
      title: "تم حذف حساب بنكي",
      message: `تم حذف حساب ${existing.bankName} باسم ${existing.accountHolderName}`,
      type: "system",
      url: "/admin/settings",
    });

    res.json({ message: "تم حذف الحساب" });
  } catch (err) {
    logger.error({ err }, "bank-accounts DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
