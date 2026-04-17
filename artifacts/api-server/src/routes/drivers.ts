import { Router } from "express";
import { db } from "@workspace/db";
import {
  driversTable,
  transactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { DriverLoginBody, AddDriverBalanceBody } from "@workspace/api-zod";

const router = Router();

router.post("/login", async (req, res) => {
  const parsed = DriverLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name } = parsed.data;

  let driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.name, name),
  });

  if (!driver) {
    const [created] = await db
      .insert(driversTable)
      .values({ name, balance: 0 })
      .returning();
    driver = created;
  }

  res.json({
    id: driver.id,
    name: driver.name,
    balance: driver.balance,
    carType: driver.carType,
    nationality: driver.nationality,
    createdAt: driver.createdAt?.toISOString(),
  });
});

router.get("/", async (_req, res) => {
  const drivers = await db.select().from(driversTable).orderBy(driversTable.createdAt);
  res.json(
    drivers.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      carType: d.carType,
      nationality: d.nationality,
      createdAt: d.createdAt?.toISOString(),
    }))
  );
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, id),
  });

  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  res.json({
    id: driver.id,
    name: driver.name,
    balance: driver.balance,
    carType: driver.carType,
    nationality: driver.nationality,
    createdAt: driver.createdAt?.toISOString(),
  });
});

router.patch("/:id/balance", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = AddDriverBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { amount } = parsed.data;

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, id),
  });

  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
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
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.get("/:id/transactions", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
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
