import { Router } from "express";
import { db } from "@workspace/db";
import { walletTransactionsTable, driversTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// GET /api/wallet-transactions — driver sees own transactions, admin sees all
router.get("/", requireAuth(), async (req, res) => {
  const user = req.session.user!;

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
});

// POST /api/wallet-transactions — driver submits a top-up request
router.post("/", requireAuth("driver"), async (req, res) => {
  const driverId = req.session.user!.id;
  const { amount, receiptUrl } = req.body ?? {};

  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "يرجى إدخال مبلغ صحيح" });
    return;
  }

  const [tx] = await db
    .insert(walletTransactionsTable)
    .values({ driverId, amount: String(amount), receiptUrl: receiptUrl ?? null })
    .returning();

  res.status(201).json(tx);
});

// POST /api/wallet-transactions/:id/approve — admin approves and credits the driver's balance
router.post("/:id/approve", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const tx = await db.query.walletTransactionsTable.findFirst({
    where: eq(walletTransactionsTable.id, id),
  });
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
    .where(eq(walletTransactionsTable.id, id))
    .returning();

  res.json({ message: "تم قبول طلب الشحن وإضافة الرصيد", transaction: updated });
});

// POST /api/wallet-transactions/:id/reject — admin rejects the top-up request
router.post("/:id/reject", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { notes } = req.body ?? {};

  const tx = await db.query.walletTransactionsTable.findFirst({
    where: eq(walletTransactionsTable.id, id),
  });
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
    .where(eq(walletTransactionsTable.id, id))
    .returning();

  res.json({ message: "تم رفض طلب الشحن", transaction: updated });
});

export default router;
