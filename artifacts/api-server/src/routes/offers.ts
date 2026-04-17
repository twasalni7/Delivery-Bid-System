import { Router } from "express";
import { db } from "@workspace/db";
import { offersTable, driversTable, requestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateOfferBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const offers = await db
    .select()
    .from(offersTable)
    .orderBy(offersTable.createdAt);

  const results = await Promise.all(
    offers.map(async (o) => {
      const driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, o.driverId),
      });
      return {
        id: o.id,
        driverId: o.driverId,
        requestId: o.requestId,
        price: o.price,
        carType: o.carType,
        nationality: o.nationality,
        driver: driver
          ? {
              id: driver.id,
              name: driver.name,
              balance: driver.balance,
              carType: driver.carType,
              nationality: driver.nationality,
              createdAt: driver.createdAt?.toISOString(),
            }
          : null,
        createdAt: o.createdAt?.toISOString(),
      };
    })
  );

  res.json(results);
});

router.post("/", async (req, res) => {
  const parsed = CreateOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { driverId, requestId, price, carType, nationality } = parsed.data;

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, driverId),
  });

  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  if (driver.balance < 50) {
    res.status(400).json({ error: "Insufficient balance. Minimum balance of 50 required to submit an offer." });
    return;
  }

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, requestId),
  });

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (request.status !== "OPEN") {
    res.status(400).json({ error: "Request is not open for offers" });
    return;
  }

  const existingOffer = await db.query.offersTable.findFirst({
    where: (o, { and }) => and(eq(o.driverId, driverId), eq(o.requestId, requestId)),
  });

  if (existingOffer) {
    res.status(400).json({ error: "You have already submitted an offer for this request" });
    return;
  }

  const [created] = await db
    .insert(offersTable)
    .values({ driverId, requestId, price, carType, nationality })
    .returning();

  res.status(201).json({
    id: created.id,
    driverId: created.driverId,
    requestId: created.requestId,
    price: created.price,
    carType: created.carType,
    nationality: created.nationality,
    driver: {
      id: driver.id,
      name: driver.name,
      balance: driver.balance,
      carType: driver.carType,
      nationality: driver.nationality,
      createdAt: driver.createdAt?.toISOString(),
    },
    createdAt: created.createdAt?.toISOString(),
  });
});

export default router;
