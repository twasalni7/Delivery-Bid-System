import { Router } from "express";
import { db } from "@workspace/db";
import { driversTable, transactionsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { AddDriverBalanceBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", async (_req, res) => {
  const drivers = await db
    .select()
    .from(driversTable)
    .where(ne(driversTable.status, "DELETED"))
    .orderBy(driversTable.createdAt);
  res.json(
    drivers.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      carType: d.carType,
      nationality: d.nationality,
      status: d.status,
      warningCount: d.warningCount,
      createdAt: d.createdAt?.toISOString(),
    }))
  );
});

router.get("/me", requireAuth("driver"), async (req, res) => {
  const driverId = req.session.user!.id;
  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, driverId),
  });
  if (!driver) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({
    id: driver.id,
    name: driver.name,
    mobile: driver.mobile,
    balance: driver.balance,
    carType: driver.carType,
    nationality: driver.nationality,
    age: driver.age,
    nationalId: driver.nationalId,
    status: driver.status,
    warningCount: driver.warningCount,
    createdAt: driver.createdAt?.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, id),
  });

  if (!driver) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }

  res.json({
    id: driver.id,
    name: driver.name,
    balance: driver.balance,
    carType: driver.carType,
    nationality: driver.nationality,
    status: driver.status,
    warningCount: driver.warningCount,
    createdAt: driver.createdAt?.toISOString(),
  });
});

router.patch("/:id/balance", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const parsed = AddDriverBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const { amount } = parsed.data;

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, id),
  });

  if (!driver) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }

  const [updated] = await db
    .update(driversTable)
    .set({ balance: driver.balance + amount })
    .where(eq(driversTable.id, id))
    .returning();

  await db.insert(transactionsTable).values({
    driverId: id,
    amount,
    type: "CREDIT",
  });

  res.json({
    id: updated.id,
    name: updated.name,
    balance: updated.balance,
    carType: updated.carType,
    nationality: updated.nationality,
    status: updated.status,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.get("/:id/transactions", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.driverId, id))
    .orderBy(transactionsTable.createdAt);

  res.json(
    txns.map((t) => ({
      id: t.id,
      driverId: t.driverId,
      amount: t.amount,
      type: t.type,
      createdAt: t.createdAt?.toISOString(),
    }))
  );
});

export default router;
