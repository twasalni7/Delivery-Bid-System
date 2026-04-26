import { Router } from "express";
import { db } from "@workspace/db";
import { walletTransactionsTable, driversTable, adminsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// Helper: notify all admins
async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
}) {
  try {
    const admins = await db.select({ id: adminsTable.id }).from(adminsTable);
    for (const admin of admins) {
      void notify({ userId: admin.id, userRole: "admin", url: params.url, ...params });
    }
  } catch {
    // Silent
  }
}

// GET /api/wallet-transactions — driver sees own transactions, admin sees all
router.get("/", requireAuth(), async (req, res) => {
  const user = req.session.user!;
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
  const driverId = req.session.user!.id;
  const { amount, receiptUrl } = req.body ?? {};

  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "يرجى إدخال مبلغ صحيح" });
    return;
  }
  try {
    const [tx] = await db
      .insert(walletTransactionsTable)
      .values({ driverId, amount: String(amount), receiptUrl: receiptUrl ?? null })
      .returning();

    // Notify all admins about the new wallet top-up request
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, driverId),
      columns: { name: true },
    });
    void notifyAllAdmins({
      title: "طلب شحن محفظة جديد",
      message: `طلب السائق ${driver?.name ?? `#${driverId}`} شحن محفظته بمبلغ ${parseFloat(String(amount)).toFixed(2)} ريال`,
      type: "system",
      relatedId: tx.id,
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

    // Credit the driver's wallet
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, tx.driverId),
    });
    if (!driver) {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    await db
      .update(driversTable)
      .set({ balance: (driver.balance ?? 0) + parseFloat(tx.amount) })
      .where(eq(driversTable.id, tx.driverId));

    const [updated] = await db
      .update(walletTransactionsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(walletTransactionsTable.id, tx.id))
      .returning();

    // Notify driver
    void notify({
      userId: tx.driverId,
      userRole: "driver",
      title: "تم قبول طلب شحن محفظتك",
      message: `تمت الموافقة على طلب شحن محفظتك بمبلغ ${parseFloat(tx.amount).toFixed(2)} ريال وإضافته لرصيدك`,
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
