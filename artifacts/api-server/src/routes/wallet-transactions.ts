import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { walletTransactionsTable, driversTable, transactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { notify, notifyAllAdmins } from "../lib/notify";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";
import { withDbTransaction } from "../lib/db-transaction";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// Accept both standard https:// URLs and data: URLs (used as fallback when
// external storage is not configured).
const receiptUrlSchema = z
  .string()
  .refine(
    (v) => {
      // Allow standard URLs
      if (z.string().url().safeParse(v).success) return true;

      // Validate data URLs more strictly
      if (v.startsWith("data:")) {
        // Only allow image data URLs
        if (!v.startsWith("data:image/")) return false;

        // Only allow specific image MIME types (no SVG for security)
        const allowedMimeTypes = ["data:image/jpeg", "data:image/png", "data:image/webp"];
        if (!allowedMimeTypes.some(type => v.startsWith(type))) return false;

        // Check size limit (5MB) - data URLs are base64 encoded (~33% larger)
        // So we check for ~6.65MB of base64 data (5MB * 1.33)
        const MAX_DATA_URL_LENGTH = 6.65 * 1024 * 1024;
        if (v.length > MAX_DATA_URL_LENGTH) return false;

        return true;
      }

      return false;
    },
    { message: "رابط الإيصال غير صحيح أو حجم الملف كبير جداً" }
  );

const CreateWalletTxBody = z.object({
  amount: z.number().min(0.01),
  receiptUrl: receiptUrlSchema,
});

// GET /api/wallet-transactions — driver sees own transactions, admin sees all
router.get("/", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  try {
    if (user.role === "driver") {
      const rows = await db
        .select()
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.driverId, user.id))
        .orderBy(desc(walletTransactionsTable.createdAt));
      res.json(rows);
      return;
    }

    if (user.role === "admin") {
      const rows = await db
        .select({
          id: walletTransactionsTable.id,
          intId: walletTransactionsTable.intId,
          driverId: walletTransactionsTable.driverId,
          driverName: driversTable.name,
          amount: walletTransactionsTable.amount,
          receiptUrl: walletTransactionsTable.receiptUrl,
          status: walletTransactionsTable.status,
          notes: walletTransactionsTable.notes,
          createdAt: walletTransactionsTable.createdAt,
          updatedAt: walletTransactionsTable.updatedAt,
        })
        .from(walletTransactionsTable)
        .leftJoin(driversTable, eq(walletTransactionsTable.driverId, driversTable.id))
        .orderBy(desc(walletTransactionsTable.createdAt));
      res.json(rows);
      return;
    }

    res.status(403).json({ error: "غير مصرح" });
  } catch (err) {
    logger.error({ err }, "wallet-transactions GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// POST /api/wallet-transactions — driver submits a top-up request
router.post("/", requireAuth("driver"), async (req, res) => {
  const parsed = CreateWalletTxBody.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors[0]?.message || "يرجى إدخال مبلغ صحيح وإرفاق صورة الإيصال";
    res.status(400).json({ error: errorMsg });
    return;
  }
  const driverId = getSessionUser(req)!.id;
  const { amount, receiptUrl } = parsed.data;
  try {
    const [tx] = await db
      .insert(walletTransactionsTable)
      .values({
        // int_id now uses a DB sequence (migration 018) — no race condition
        driverId,
        amount: String(amount),
        receiptUrl,
      })
      .returning();

    // Notify all admins about the new wallet top-up request
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, driverId),
      columns: { name: true },
    });
    void notifyAllAdmins({
      title: "طلب شحن محفظة جديد",
      message: `طلب السائق ${driver?.name ?? `#${driverId}`} شحن محفظته بمبلغ ${amount.toFixed(2)} ريال`,
      type: "system",
      relatedId: tx!.id,
      url: "/admin/settings",
    });

    res.status(201).json(tx);
  } catch (err) {
    logger.error({ err }, "wallet-transactions POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Resolve a wallet transaction by int_id or id (prefer int_id when available)
async function findWalletTxByIntId(intId: number) {
  // Try int_id first (for UUID-primary-key environments)
  const byIntId = await db.query.walletTransactionsTable.findFirst({
    where: eq(walletTransactionsTable.intId, intId),
  });
  if (byIntId) return byIntId;
  // Fallback to serial id
  return db.query.walletTransactionsTable.findFirst({
    where: eq(walletTransactionsTable.id, intId),
  });
}

function resolveWalletTxWhereClause(tx: Awaited<ReturnType<typeof findWalletTxByIntId>>) {
  if (tx?.intId != null) {
    return eq(walletTransactionsTable.intId, tx.intId);
  }
  if (tx?.id != null) {
    return eq(walletTransactionsTable.id, tx.id);
  }
  return null;
}

// POST /api/wallet-transactions/:id/approve — admin approves and credits the driver's balance
router.post("/:id/approve", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const tx = await findWalletTxByIntId(id);
    if (!tx) {
      res.status(404).json({ error: "المعاملة غير موجودة" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(400).json({ error: "المعاملة ليست في حالة انتظار" });
      return;
    }

    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, tx.driverId),
    });
    if (!driver) {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    const creditAmount = Number.parseFloat(String(tx.amount));
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      res.status(400).json({ error: "قيمة مبلغ الشحن غير صحيحة" });
      return;
    }

    const txWhereClause = resolveWalletTxWhereClause(tx);
    if (!txWhereClause) {
      res.status(400).json({ error: "تعذّر تحديد معاملة الشحن" });
      return;
    }

    // Atomically: credit balance + update wallet-transaction status + insert ledger entry
    const [updated] = await withDbTransaction(async (txDb) => {
      await txDb
        .update(driversTable)
        .set({ balance: sql`${driversTable.balance} + ${creditAmount}::numeric` })
        .where(eq(driversTable.id, tx.driverId));

      // Unified financial ledger entry (same table as bid-fee deductions)
      await txDb.insert(transactionsTable).values({
        driverId: tx.driverId,
        amount: String(creditAmount),
        type: "credit",
      });

      return txDb
        .update(walletTransactionsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(txWhereClause)
        .returning();
    });

    await logActivity({
      actorId:   getSessionUser(req)?.id,
      actorRole: "admin",
      action:    "wallet.approved",
      entity:    "wallet_transactions",
      entityId:  tx.id,
      metadata:  { driverId: tx.driverId, amount: creditAmount },
      req,
    });

    // Notify driver
    void notify({
      userId: tx.driverId,
      userRole: "driver",
      title: "تم قبول طلب شحن محفظتك",
      message: `تمت الموافقة على طلب شحن محفظتك بمبلغ ${creditAmount.toFixed(2)} ريال وإضافته لرصيدك`,
      type: "system",
      relatedId: tx.id,
      url: "/driver/profile",
    });

    res.json({ message: "تم قبول طلب الشحن وإضافة الرصيد", transaction: updated });
  } catch (err) {
    logger.error({ err }, "wallet-transactions POST /:id/approve error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// POST /api/wallet-transactions/:id/reject — admin rejects the top-up request
router.post("/:id/reject", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { notes } = req.body ?? {};
  try {
    const tx = await findWalletTxByIntId(id);
    if (!tx) {
      res.status(404).json({ error: "المعاملة غير موجودة" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(400).json({ error: "المعاملة ليست في حالة انتظار" });
      return;
    }

    const txWhereClause = resolveWalletTxWhereClause(tx);
    if (!txWhereClause) {
      res.status(400).json({ error: "تعذّر تحديد معاملة الشحن" });
      return;
    }

    const [updated] = await db
      .update(walletTransactionsTable)
      .set({ status: "rejected", notes: notes ?? null, updatedAt: new Date() })
      .where(txWhereClause)
      .returning();

    await logActivity({
      actorId:   getSessionUser(req)?.id,
      actorRole: "admin",
      action:    "wallet.rejected",
      entity:    "wallet_transactions",
      entityId:  tx.id,
      metadata:  { driverId: tx.driverId, amount: parseFloat(tx.amount), notes: notes ?? null },
      req,
    });

    // Notify driver
    void notify({
      userId: tx.driverId,
      userRole: "driver",
      title: "تم رفض طلب شحن محفظتك",
      message: `تم رفض طلب شحن محفظتك بمبلغ ${parseFloat(tx.amount).toFixed(2)} ريال${notes ? ` — السبب: ${notes}` : ""}`,
      type: "system",
      relatedId: tx.id,
      url: "/driver/profile",
    });

    res.json({ message: "تم رفض طلب الشحن", transaction: updated });
  } catch (err) {
    logger.error({ err }, "wallet-transactions POST /:id/reject error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
