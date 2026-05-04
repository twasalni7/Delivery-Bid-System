import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { walletTransactionsTable, driversTable, transactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { notify, notifyAllAdmins } from "../lib/notify";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

const CreateWalletTxBody = z.object({
  amount: z.number().min(0.01),
  receiptUrl: z.string().url().optional().nullable(),
});

/** Wraps callback in a real DB transaction when available, logs a warning and falls back gracefully. */
async function withTx<T>(cb: (tx: typeof db) => Promise<T>): Promise<T> {
  const dbAny = db as typeof db & { transaction?: (cb: (tx: typeof db) => Promise<T>) => Promise<T> };
  if (typeof dbAny.transaction === "function") {
    return dbAny.transaction(cb);
  }
  logger.warn("withTx: db.transaction unavailable — running wallet operations without atomicity");
  return cb(db);
}

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
    res.status(400).json({ error: "يرجى إدخال مبلغ صحيح أكبر من الصفر" });
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
        receiptUrl: receiptUrl ?? null,
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

    const creditAmount = parseFloat(tx.amount);

    // Atomically: credit balance + update wallet-transaction status + insert ledger entry
    const [updated] = await withTx(async (txDb) => {
      await txDb
        .update(driversTable)
        .set({ balance: sql`${driversTable.balance} + ${creditAmount}::numeric` })
        .where(eq(driversTable.id, tx.driverId));

      // Unified financial ledger entry (same table as bid-fee deductions)
      await txDb.insert(transactionsTable).values({
        driverId: tx.driverId,
        amount: String(creditAmount),
        type: "topup",
      });

      return txDb
        .update(walletTransactionsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(walletTransactionsTable.id, tx.id))
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

    const [updated] = await db
      .update(walletTransactionsTable)
      .set({ status: "rejected", notes: notes ?? null, updatedAt: new Date() })
      .where(eq(walletTransactionsTable.id, tx.id))
      .returning();

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
