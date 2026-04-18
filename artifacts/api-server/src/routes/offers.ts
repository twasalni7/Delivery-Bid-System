import { Router } from "express";
import { db } from "@workspace/db";
import { offersTable, driversTable, requestsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { CreateOfferBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth("admin"), async (_req, res) => {
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
              mobile: driver.mobile,
              balance: driver.balance,
              carType: driver.carType,
              nationality: driver.nationality,
              status: driver.status,
              createdAt: driver.createdAt?.toISOString(),
            }
          : null,
        createdAt: o.createdAt?.toISOString(),
      };
    })
  );

  res.json(results);
});

router.get("/my", requireAuth("driver"), async (req, res) => {
  const driverId = req.session.user!.id;

  const offers = await db
    .select()
    .from(offersTable)
    .where(eq(offersTable.driverId, driverId))
    .orderBy(offersTable.createdAt);

  const results = await Promise.all(
    offers.map(async (o) => {
      const request = await db.query.requestsTable.findFirst({
        where: eq(requestsTable.id, o.requestId),
      });
      return {
        id: o.id,
        driverId: o.driverId,
        requestId: o.requestId,
        price: o.price,
        carType: o.carType,
        nationality: o.nationality,
        request: request
          ? {
              id: request.id,
              homeLocation: request.homeLocation,
              workLocation: request.workLocation,
              morningTime: request.morningTime,
              eveningTime: request.eveningTime,
              numberOfPeople: request.numberOfPeople,
              workingDaysPerWeek: request.workingDaysPerWeek,
              status: request.status,
            }
          : null,
        createdAt: o.createdAt?.toISOString(),
      };
    })
  );

  res.json(results);
});

router.put("/:id", requireAuth("driver"), async (req, res) => {
  const offerId = parseInt(req.params.id, 10);
  if (isNaN(offerId)) {
    res.status(400).json({ error: "معرف العرض غير صحيح" });
    return;
  }

  const { price: rawPrice } = req.body as { price?: unknown };
  const price =
    typeof rawPrice === "number"
      ? rawPrice
      : parseFloat(String(rawPrice ?? ""));
  if (!isFinite(price) || price <= 0) {
    res.status(400).json({ error: "السعر غير صحيح" });
    return;
  }
  const driverId = req.session.user!.id;

  const offer = await db.query.offersTable.findFirst({
    where: eq(offersTable.id, offerId),
  });

  if (!offer) {
    res.status(404).json({ error: "العرض غير موجود" });
    return;
  }

  if (offer.driverId !== driverId) {
    res.status(403).json({ error: "غير مصرح لك بتعديل هذا العرض" });
    return;
  }

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, offer.requestId),
  });

  if (
    !request ||
    (request.status !== "OPEN" && request.status !== "BIDDING")
  ) {
    res.status(400).json({
      error: "لا يمكن تعديل العرض — الطلب لم يعد مفتوحاً للعروض",
    });
    return;
  }

  const [updated] = await db
    .update(offersTable)
    .set({ price })
    .where(and(eq(offersTable.id, offerId), eq(offersTable.driverId, driverId)))
    .returning();

  res.json({
    id: updated.id,
    driverId: updated.driverId,
    requestId: updated.requestId,
    price: updated.price,
    carType: updated.carType,
    nationality: updated.nationality,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.delete("/:id", requireAuth("driver"), async (req, res) => {
  const offerId = parseInt(req.params.id, 10);
  if (isNaN(offerId)) {
    res.status(400).json({ error: "معرف العرض غير صحيح" });
    return;
  }

  const driverId = req.session.user!.id;

  const offer = await db.query.offersTable.findFirst({
    where: eq(offersTable.id, offerId),
  });

  if (!offer) {
    res.status(404).json({ error: "العرض غير موجود" });
    return;
  }

  if (offer.driverId !== driverId) {
    res.status(403).json({ error: "غير مصرح لك بسحب هذا العرض" });
    return;
  }

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, offer.requestId),
  });

  if (
    !request ||
    (request.status !== "OPEN" && request.status !== "BIDDING")
  ) {
    res.status(400).json({
      error: "لا يمكن سحب العرض — الطلب لم يعد مفتوحاً للعروض",
    });
    return;
  }

  await db
    .delete(offersTable)
    .where(and(eq(offersTable.id, offerId), eq(offersTable.driverId, driverId)));

  res.json({ message: "تم سحب العرض بنجاح" });
});

router.post("/", requireAuth("driver"), async (req, res) => {
  const parsed = CreateOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const driverId = req.session.user!.id;
  const { requestId, price, carType, nationality } = parsed.data;

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, driverId),
  });

  if (!driver) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }

  if (driver.balance < 50) {
    res.status(400).json({
      error: "رصيد السائق غير كافٍ. الحد الأدنى 50 ريال للتقديم على عرض.",
    });
    return;
  }

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, requestId),
  });

  if (!request) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }

  if (request.status !== "OPEN" && request.status !== "BIDDING") {
    res.status(400).json({ error: "الطلب ليس مفتوحاً للعروض" });
    return;
  }

  const existingOffer = await db.query.offersTable.findFirst({
    where: (o, { and }) =>
      and(eq(o.driverId, driverId), eq(o.requestId, requestId)),
  });

  if (existingOffer) {
    res.status(400).json({ error: "لقد قدّمت عرضاً على هذا الطلب مسبقاً" });
    return;
  }

  const [created] = await db
    .insert(offersTable)
    .values({ driverId, requestId, price, carType, nationality })
    .returning();

  // Auto-transition OPEN → BIDDING when first offer is placed
  if (request.status === "OPEN") {
    const offerCount = await db
      .select({ total: count() })
      .from(offersTable)
      .where(eq(offersTable.requestId, requestId));
    if ((offerCount[0]?.total ?? 0) >= 1) {
      await db
        .update(requestsTable)
        .set({ status: "BIDDING", updatedAt: new Date() })
        .where(eq(requestsTable.id, requestId));
    }
  }

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
      status: driver.status,
      createdAt: driver.createdAt?.toISOString(),
    },
    createdAt: created.createdAt?.toISOString(),
  });
});

export default router;
