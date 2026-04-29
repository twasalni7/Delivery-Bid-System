import { Router } from "express";
import { db } from "@workspace/db";
import { offersTable, driversTable, requestsTable, clientsTable } from "@workspace/db";
import { eq, and, ne, count, inArray } from "drizzle-orm";
import { CreateOfferBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

router.get("/", requireAuth("admin"), async (_req, res) => {
  try {
    const offers = await db
      .select()
      .from(offersTable)
      .orderBy(offersTable.createdAt);

    // Batch-fetch unique drivers with Promise.all (avoids N+1 via deduplication)
    const uniqueDriverIds = [...new Set(offers.map((o) => o.driverId))];
    const driverMap = new Map<number, typeof driversTable.$inferSelect>();
    await Promise.all(
      uniqueDriverIds.map(async (id) => {
        const d = await db.query.driversTable.findFirst({
          where: eq(driversTable.id, id),
        });
        if (d) driverMap.set(id, d);
      })
    );

    const results = offers.map((o) => {
      const driver = driverMap.get(o.driverId) ?? null;
      return {
        id: o.id,
        driverId: o.driverId,
        requestId: o.requestId,
        status: o.status,
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
    });

    res.json(results);
  } catch (err) {
    logger.error({ err }, "offers GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/my", requireAuth("driver"), async (req, res) => {
  try {
    const driverId = req.session.user!.id;

    const offers = await db
      .select()
      .from(offersTable)
      .where(eq(offersTable.driverId, driverId))
      .orderBy(offersTable.createdAt);

    if (offers.length === 0) {
      res.json([]);
      return;
    }

    const requestIds = offers.map((o) => o.requestId);

    let requests = await db
      .select()
      .from(requestsTable)
      .where(inArray(requestsTable.id, requestIds));

    if (!Array.isArray(requests)) {
      const fallbackRequests = await Promise.all(
        requestIds.map((requestId) =>
          db.query.requestsTable.findFirst({
            where: eq(requestsTable.id, requestId),
          }),
        ),
      );
      requests = fallbackRequests.filter((requestRow): requestRow is NonNullable<typeof requestRow> => Boolean(requestRow));
    }

    const requestMap = new Map(requests.map((r) => [r.id, r]));

    let competitorRows: Array<{ requestId: number; value: number | string }> = [];
    try {
      const maybeCompetitorRows = await db
        .select({ requestId: offersTable.requestId, value: count() })
        .from(offersTable)
        .where(and(
          inArray(offersTable.requestId, requestIds),
          ne(offersTable.driverId, driverId),
          eq(offersTable.status, "PENDING"),
        ))
        .groupBy(offersTable.requestId);
      if (Array.isArray(maybeCompetitorRows)) {
        competitorRows = maybeCompetitorRows;
      }
    } catch {
      competitorRows = [];
    }
    const competitorMap = new Map(competitorRows.map((r) => [r.requestId, Number(r.value)]));

    // Batch-fetch client names for all unique client IDs
    const clientIds = [...new Set(requests.map((r) => r.clientId).filter((id): id is number => id != null))];
    const clientMap = new Map<number, string>();
    if (clientIds.length > 0) {
      let clients = await db
        .select({ id: clientsTable.id, name: clientsTable.name })
        .from(clientsTable)
        .where(inArray(clientsTable.id, clientIds));
      if (!Array.isArray(clients)) {
        clients = [];
      }
      for (const c of clients) clientMap.set(c.id, c.name);
    }

    const results = offers.map((o) => {
      const request = requestMap.get(o.requestId) ?? null;
      const competitorCount = competitorMap.get(o.requestId) ?? 0;
      const clientName = request?.clientId != null ? (clientMap.get(request.clientId) ?? null) : null;

      return {
        id: o.id,
        driverId: o.driverId,
        requestId: o.requestId,
        status: o.status,
        competitorCount,
        clientName,
        request: request
          ? {
              id: request.id,
              homeLocation: request.homeLocation,
              workLocation: request.workLocation,
              morningTime: request.morningTime,
              eveningTime: request.eveningTime,
              numberOfPeople: request.numberOfPeople,
              workingDaysPerWeek: request.workingDaysPerWeek,
              monthlyPrice: request.monthlyPrice,
              clientType: request.clientType,
              status: request.status,
            }
          : null,
        createdAt: o.createdAt?.toISOString(),
      };
    });

    res.json(results);
  } catch (err) {
    logger.error({ err }, "offers GET /my error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.delete("/:id", requireAuth("driver"), async (req, res) => {
  const offerId = parseInt(req.params.id as string, 10);
  if (isNaN(offerId)) {
    res.status(400).json({ error: "معرف العرض غير صحيح" });
    return;
  }

  const driverId = req.session.user!.id;
  try {
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

    if (!request || request.status !== "OPEN") {
      res.status(400).json({
        error: "لا يمكن سحب القبول — الطلب لم يعد مفتوحاً",
      });
      return;
    }

    await db
      .delete(offersTable)
      .where(and(eq(offersTable.id, offerId), eq(offersTable.driverId, driverId)));

    res.json({ message: "تم سحب القبول بنجاح" });
  } catch (err) {
    logger.error({ err }, "offers DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/", requireAuth("driver"), async (req, res) => {
  const parsed = CreateOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const driverId = req.session.user!.id;
  const { requestId } = parsed.data;
  try {
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, driverId),
    });

    if (!driver) {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    if (driver.balance < 50) {
      res.status(400).json({
        error: "رصيد السائق غير كافٍ. الحد الأدنى 50 ريال للقبول على طلب.",
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

    if (request.status !== "OPEN") {
      res.status(400).json({ error: "الطلب ليس مفتوحاً للقبول" });
      return;
    }

    const existingOffer = await db.query.offersTable.findFirst({
      where: (o, { and }) =>
        and(eq(o.driverId, driverId), eq(o.requestId, requestId)),
    });

    if (existingOffer) {
      res.status(400).json({ error: "لقد قبلت هذا الطلب مسبقاً" });
      return;
    }

    const [created] = await db
      .insert(offersTable)
      .values({ driverId, requestId, status: "PENDING" })
      .returning();

    // Notify the client that a driver accepted their request
    if (request.clientId) {
      void notify({
        userId: request.clientId,
        userRole: "client",
        title: "سائق قبل طلبك",
        message: `قبل السائق ${driver.name} طلبك من ${request.homeLocation} إلى ${request.workLocation}`,
        type: "offer",
        relatedId: request.id,
        url: `/client/request/${request.id}`,
      });
    }

    res.status(201).json({
      id: created.id,
      driverId: created.driverId,
      requestId: created.requestId,
      status: created.status,
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
  } catch (err) {
    logger.error({ err }, "offers POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
