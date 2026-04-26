import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  transactionsTable,
} from "@workspace/db";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { notify } from "../lib/notify";
import {
  CreateRequestBody,
  UpdateRequestStatusBody,
  SelectOfferBody,
  ListRequestsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

const ALL_STATUSES = new Set([
  "OPEN",
  "SELECTED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "FROZEN",
]);

function canSeePhone(
  req: Request,
  r: typeof requestsTable.$inferSelect
): boolean {
  const user = getSessionUser(req);
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "client" && r.clientId === user.id) return true;
  if (
    user.role === "driver" &&
    r.selectedDriverId === user.id &&
    (r.status === "SELECTED" ||
      r.status === "ACTIVE" ||
      r.status === "COMPLETED")
  )
    return true;
  return false;
}

function formatDriver(
  d: typeof driversTable.$inferSelect,
  showContact: boolean
) {
  return {
    id: d.id,
    name: d.name,
    balance: d.balance,
    carType: d.carType,
    nationality: d.nationality,
    mobile: showContact ? d.mobile : null,
    status: d.status,
    warningCount: d.warningCount,
    createdAt: d.createdAt?.toISOString(),
  };
}

function formatRequest(
  req: Request,
  r: typeof requestsTable.$inferSelect,
  driver?: typeof driversTable.$inferSelect | null
) {
  const showPhone = canSeePhone(req, r);
  const user = getSessionUser(req);
  const postSelection =
    r.status === "SELECTED" || r.status === "ACTIVE" || r.status === "COMPLETED";
  const showDriverContact =
    user?.role === "admin" ||
    (user?.role === "client" && r.clientId === user.id && postSelection);
  return {
    id: r.id,
    clientId: r.clientId,
    clientType: r.clientType,
    homeLocation: r.homeLocation,
    workLocation: r.workLocation,
    additionalLocations: r.additionalLocations,
    phone: showPhone ? r.phone : null,
    phoneHidden: !showPhone,
    numberOfPeople: r.numberOfPeople,
    workingDaysPerWeek: r.workingDaysPerWeek,
    numberOfShifts: r.numberOfShifts,
    morningTime: r.morningTime,
    eveningTime: r.eveningTime,
    notes: r.notes,
    monthlyPrice: r.monthlyPrice,
    status: r.status,
    selectedDriverId: r.selectedDriverId,
    selectedDriver: driver ? formatDriver(driver, showDriverContact) : null,
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const parsed = ListRequestsQueryParams.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;
    const sessionUser = req.session?.user;
    const isClient = sessionUser?.role === "client";
    const isDriver = sessionUser?.role === "driver";

    // Pagination
    const rawPage = parseInt(req.query["page"] as string, 10);
    const rawLimit = parseInt(req.query["limit"] as string, 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status)
      conditions.push(
        eq(requestsTable.status, status as typeof requestsTable.$inferSelect["status"])
      );
    if (isClient) conditions.push(eq(requestsTable.clientId, sessionUser!.id));
    // Drivers see only OPEN requests (plus their own accepted ones handled by /drivers/me/requests)
    if (isDriver) conditions.push(eq(requestsTable.status, "OPEN"));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(requestsTable)
      .where(whereClause)
      .orderBy(requestsTable.createdAt)
      .limit(limit)
      .offset(offset);

    const requestIds = rows.map((r) => r.id);
    const offerCounts: Record<number, number> = {};
    if (requestIds.length > 0) {
      const countRows = await db
        .select({ requestId: offersTable.requestId, total: count() })
        .from(offersTable)
        .where(inArray(offersTable.requestId, requestIds))
        .groupBy(offersTable.requestId);
      for (const row of countRows) {
        if (row.requestId != null) offerCounts[row.requestId] = row.total;
      }
    }

    // Batch-load all required drivers in a single query (fixes N+1)
    const driverIds = [
      ...new Set(
        rows
          .filter((r) => r.selectedDriverId != null)
          .map((r) => r.selectedDriverId!)
      ),
    ];
    const driversMap = new Map<number, typeof driversTable.$inferSelect>();
    if (driverIds.length > 0) {
      const drivers = await db
        .select()
        .from(driversTable)
        .where(inArray(driversTable.id, driverIds));
      for (const d of drivers) driversMap.set(d.id, d);
    }

    const results = rows.map((r) => {
      const driver = r.selectedDriverId ? (driversMap.get(r.selectedDriverId) ?? null) : null;
      return { ...formatRequest(req, r, driver), offerCount: offerCounts[r.id] ?? 0 };
    });

    res.json(results);
  } catch (err) {
    logger.error({ err }, "requests GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/", requireAuth("client"), async (req, res) => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  try {
    const clientId = req.session.user!.id;

    const [created] = await db
      .insert(requestsTable)
      .values({
        ...parsed.data,
        clientType: parsed.data.clientType ?? "غيره",
        monthlyPrice: parsed.data.monthlyPrice,
        clientId,
        status: "OPEN",
      })
      .returning();

    res.status(201).json(formatRequest(req, created, null));
  } catch (err) {
    logger.error({ err }, "requests POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const request = await db.query.requestsTable.findFirst({
      where: eq(requestsTable.id, id),
    });

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const sessionUser = getSessionUser(req);
    if (
      sessionUser?.role === "client" &&
      request.clientId !== sessionUser.id
    ) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }

    let driver = null;
    if (request.selectedDriverId) {
      driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, request.selectedDriverId),
      });
    }

    res.json(formatRequest(req, request, driver));
  } catch (err) {
    logger.error({ err }, "requests GET /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id/status", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const parsed = UpdateRequestStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  try {
    const [updated] = await db
      .update(requestsTable)
      .set({
        status: parsed.data.status as typeof requestsTable.$inferSelect["status"],
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    // Notify the client about status change
    if (updated.clientId) {
      const statusMessages: Record<string, string> = {
        ACTIVE: "🚀 طلبك أصبح نشطاً — ابدأ رحلتك مع السائق",
        COMPLETED: "✅ تم إتمام طلبك بنجاح",
        CANCELLED: "❌ تم إلغاء طلبك من قِبل الإدارة",
        FROZEN: "⏸️ تم تجميد طلبك مؤقتاً",
        EXPIRED: "⏰ انتهت صلاحية طلبك",
      };
      const msg = statusMessages[parsed.data.status];
      if (msg) {
        void notify({
          userId: updated.clientId,
          userRole: "client",
          title: "تحديث حالة طلبك",
          message: msg,
          type: "request",
          relatedId: updated.id,
        });
      }
    }

    let driver = null;
    if (updated.selectedDriverId) {
      driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, updated.selectedDriverId),
      });
    }

    res.json(formatRequest(req, updated, driver));
  } catch (err) {
    logger.error({ err }, "requests PATCH /:id/status error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/:id/select-offer", requireAuth("client"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const parsed = SelectOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const { offerId } = parsed.data;
  const clientId = req.session.user!.id;
  try {
    const request = await db.query.requestsTable.findFirst({
      where: eq(requestsTable.id, id),
    });

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (request.clientId == null || request.clientId !== clientId) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }

    if (request.status !== "OPEN") {
      res.status(400).json({ error: "لا يمكن تأكيد سائق بعد اختيار سائق آخر" });
      return;
    }

    const offer = await db.query.offersTable.findFirst({
      where: eq(offersTable.id, offerId),
    });

    if (!offer || offer.requestId !== id) {
      res.status(404).json({ error: "العرض غير موجود لهذا الطلب" });
      return;
    }

    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, offer.driverId),
    });

    if (!driver) {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    if (driver.balance < 50) {
      res
        .status(400)
        .json({ error: "رصيد السائق غير كافٍ (الحد الأدنى 50 ريال)" });
      return;
    }

    await db
      .update(driversTable)
      .set({ balance: sql`${driversTable.balance} - 50` })
      .where(eq(driversTable.id, driver.id));

    await db.insert(transactionsTable).values({
      driverId: driver.id,
      amount: -50,
      type: "fee",
    });

    const [updated] = await db
      .update(requestsTable)
      .set({ status: "SELECTED", selectedDriverId: driver.id, updatedAt: new Date() })
      .where(eq(requestsTable.id, id))
      .returning();

    const updatedDriver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, driver.id),
    });

    // Notify the selected driver
    void notify({
      userId: driver.id,
      userRole: "driver",
      title: "🎉 تم اختيارك!",
      message: `اختار العميل عرضك على الطلب من ${request.homeLocation} إلى ${request.workLocation} بسعر ${request.monthlyPrice.toFixed(0)} ر.س/شهر`,
      type: "request",
      relatedId: request.id,
    });

    res.json(formatRequest(req, updated, updatedDriver));
  } catch (err) {
    logger.error({ err }, "requests POST /:id/select-offer error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id/offers", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const request = await db.query.requestsTable.findFirst({
      where: eq(requestsTable.id, id),
    });
    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const sessionUser = getSessionUser(req);
    const isAdmin = sessionUser?.role === "admin";
    const isOwner =
      sessionUser?.role === "client" && sessionUser.id === request.clientId;
    const postSelection =
      request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED";

    const offers = await db
      .select()
      .from(offersTable)
      .where(eq(offersTable.requestId, id))
      .orderBy(offersTable.createdAt);

    const results = await Promise.all(
      offers.map(async (o) => {
        const driver = await db.query.driversTable.findFirst({
          where: eq(driversTable.id, o.driverId),
        });
        const isSelectedDriver =
          request.selectedDriverId != null &&
          driver?.id === request.selectedDriverId;
        const revealMobile =
          isAdmin || (isOwner && postSelection && isSelectedDriver);

        return {
          id: o.id,
          driverId: o.driverId,
          requestId: o.requestId,
          status: o.status,
          driver: driver ? formatDriver(driver, revealMobile) : null,
          createdAt: o.createdAt?.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (err) {
    logger.error({ err }, "requests GET /:id/offers error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status, selectedDriverId } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!ALL_STATUSES.has(status as string)) {
      res.status(400).json({ error: "قيمة الحالة غير صحيحة" });
      return;
    }
    updates.status = status;
    updates.updatedAt = new Date();
  }
  if (selectedDriverId !== undefined) updates.selectedDriverId = selectedDriverId;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }
  try {
    const [updated] = await db
      .update(requestsTable)
      .set(updates)
      .where(eq(requestsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    let driver = null;
    if (updated.selectedDriverId) {
      driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, updated.selectedDriverId),
      });
    }

    res.json(formatRequest(req, updated, driver));
  } catch (err) {
    logger.error({ err }, "requests PATCH /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.delete("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const deleted = await db
      .delete(requestsTable)
      .where(eq(requestsTable.id, id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    res.json({ message: "تم حذف الطلب" });
  } catch (err) {
    logger.error({ err }, "requests DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
