import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  transactionsTable,
  requestStopsTable,
  requestPassengersTable,
  clientsTable,
} from "@workspace/db";
import { eq, and, count, inArray, ne, sql, isNull, isNotNull } from "drizzle-orm";
import { notify, notifyAllAdmins, notifyAllDrivers } from "../lib/notify";
import {
  CreateRequestBody,
  UpdateRequestStatusBody,
  SelectOfferBody,
  ListRequestsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireHardDeleteApproval } from "../middleware/requireHardDeleteApproval";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";
import { getBidFee } from "./pricing";
import { withDbTransaction } from "../lib/db-transaction";
import {
  logRequestStatusTransition,
  resolveRequestStatus,
  type RequestStatus,
} from "../lib/request-status-engine";
import {
  resolveRequestRoutingAndPricing,
  type PassengerRoutingInput,
  type StopRoutingInput,
} from "../lib/request-routing";

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
const TERMINAL_STATUSES = new Set<RequestStatus>(["COMPLETED", "CANCELLED"]);

/** Convert a value that may be a numeric string (Drizzle returns numeric as string) to a JS number. */
function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function buildArchivedAt(status: RequestStatus, current?: Date | null) {
  // Preserve the first archive timestamp so repeated terminal-state updates do not
  // keep moving the request around the archive timeline.
  if (!TERMINAL_STATUSES.has(status)) return null;
  return current ?? new Date();
}

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
    balance: toNum(d.balance),
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
  driver?: typeof driversTable.$inferSelect | null,
  client?: typeof clientsTable.$inferSelect | null
) {
  const showPhone = canSeePhone(req, r);
  const user = getSessionUser(req);
  const postSelection =
    r.status === "SELECTED" || r.status === "ACTIVE" || r.status === "COMPLETED";
  const showDriverContact =
    user?.role === "admin" ||
    (user?.role === "client" && r.clientId === user.id && postSelection);

  // Drivers only see exact GPS coordinates once they are the selected driver.
  // For OPEN requests (bid phase), expose null coordinates to prevent
  // drivers from mapping client home/work locations before any contract is formed.
  const showExactCoords =
    user?.role === "admin" ||
    user?.role === "client" ||
    (user?.role === "driver" && r.selectedDriverId === user.id);

  return {
    id: r.id,
    clientId: r.clientId,
    clientType: r.clientType,
    homeLocation: r.homeLocation,
    workLocation: r.workLocation,
    additionalLocations: r.additionalLocations,
    shifts: r.shifts,
    phone: showPhone ? r.phone : null,
    phoneHidden: !showPhone,
    numberOfPeople: r.numberOfPeople,
    workingDaysPerWeek: r.workingDaysPerWeek,
    numberOfShifts: r.numberOfShifts,
    morningTime: r.morningTime,
    eveningTime: r.eveningTime,
    notes: r.notes,
    homeLat: showExactCoords ? r.homeLat : null,
    homeLng: showExactCoords ? r.homeLng : null,
    destLat: showExactCoords ? r.destLat : null,
    destLng: showExactCoords ? r.destLng : null,
    distanceKm: r.distanceKm,
    durationMinutes: r.durationMinutes,
    coordinates: showExactCoords ? r.coordinates : null,
    routePolyline: showExactCoords ? r.routePolyline : null,
    pricingSnapshot: r.pricingSnapshot,
    needsAdminReview: r.needsAdminReview,
    monthlyPrice: toNum(r.monthlyPrice),
    status: r.status,
    // Only expose the manual-override flag to admins so clients/drivers cannot see it
    ...(user?.role === "admin" ? { statusManuallySetByAdmin: r.statusManuallySetByAdmin } : {}),
    selectedDriverId: r.selectedDriverId,
    selectedDriver: driver ? formatDriver(driver, showDriverContact) : null,
    client:
      user?.role === "admin" && client
        ? {
            id: client.id,
            name: client.name,
            mobile: client.mobile,
            createdAt: client.createdAt?.toISOString(),
          }
        : null,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdBy: r.createdBy ?? "client",
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

router.get("/", requireAuth(), async (req, res) => {
  try {
    const parsed = ListRequestsQueryParams.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;
    const archivedOnly = String(req.query["archived"] ?? "").toLowerCase() === "true";
    const sessionUser = getSessionUser(req);
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
    if (archivedOnly) {
      conditions.push(isNotNull(requestsTable.archivedAt));
    } else {
      conditions.push(isNull(requestsTable.archivedAt));
    }

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

    const clientIds =
      sessionUser?.role === "admin"
        ? [...new Set(rows.map((r) => r.clientId).filter((id): id is number => id != null))]
        : [];
    const clientsMap = new Map<number, typeof clientsTable.$inferSelect>();
    if (clientIds.length > 0) {
      const clients = await db
        .select()
        .from(clientsTable)
        .where(inArray(clientsTable.id, clientIds));
      for (const client of clients) clientsMap.set(client.id, client);
    }

    const results = rows.map((r) => {
      const driver = r.selectedDriverId ? (driversMap.get(r.selectedDriverId) ?? null) : null;
      const client = r.clientId ? (clientsMap.get(r.clientId) ?? null) : null;
      return { ...formatRequest(req, r, driver, client), offerCount: offerCounts[r.id] ?? 0 };
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
    const clientId = getSessionUser(req)!.id;
    const data = parsed.data;

    // Fetch client data to get phone number (don't trust client-provided phone)
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }

    // Extract per-passenger data (not part of the Zod schema — passed as raw body field)
    const passengersInput = (req.body as { passengers?: PassengerRoutingInput[] }).passengers;
    const hasPassengers = Array.isArray(passengersInput) && passengersInput.length > 0;
    const stopsInput = Array.isArray((req.body as { stops?: unknown }).stops)
      ? ((req.body as { stops?: StopRoutingInput[] }).stops ?? [])
      : [];

    // Validate: if multiple passengers, all must have coordinates
    if (data.numberOfPeople > 1 && hasPassengers) {
      const passengers = passengersInput!;
      const missingCoords = passengers.some(
        (p) =>
          p.pickupLat == null ||
          p.pickupLng == null ||
          p.destinationLat == null ||
          p.destinationLng == null
      );
      if (missingCoords) {
        res.status(400).json({ error: "جميع الركاب يجب أن يملكوا إحداثيات محددة على الخريطة" });
        return;
      }
    }

    const routing = await resolveRequestRoutingAndPricing({
      homeLat: data.homeLat ?? null,
      homeLng: data.homeLng ?? null,
      homeLocation: data.homeLocation,
      destLat: data.destLat ?? null,
      destLng: data.destLng ?? null,
      workLocation: data.workLocation,
      stops: stopsInput,
      passengers: hasPassengers ? passengersInput! : null,
      additionalLocations:
        (data.additionalLocations as { type: "pickup" | "dropoff"; address: string }[] | undefined) ?? null,
      numberOfPeople: data.numberOfPeople ?? 1,
      workingDaysPerWeek: data.workingDaysPerWeek ?? 5,
      numberOfShifts: data.numberOfShifts ?? 1,
      eveningTime: data.eveningTime ?? null,
      shifts: (data.shifts as { label?: string; goTime: string; returnTime?: string }[] | undefined) ?? null,
    });

    const distanceKm = routing.distanceKm;
    const durationMinutes = routing.durationMinutes;
    const monthlyPrice = routing.pricing?.price ?? 0;
    const needsAdminReview = false;

    if (routing.pricing) {
      logger.info(
        {
          context: "request.create",
          engine: routing.pricing.engine,
          finalPrice: routing.pricing.price,
          pricePerPerson: routing.pricing.pricePerPerson,
          distanceKm,
          durationMinutes,
          workingDaysPerWeek: data.workingDaysPerWeek ?? 5,
          numberOfShifts: data.numberOfShifts ?? 1,
          additionalLocationsCount: Array.isArray(data.additionalLocations) ? data.additionalLocations.length : 0,
          numberOfPeople: data.numberOfPeople ?? 1,
        },
        "request.create: price calculated"
      );
    }

    const initialStatus = resolveRequestStatus({
      currentStatus: "OPEN",
      selectedDriverId: null,
      needsAdminReview,
      event: "request_created",
    }).status;

    const [created] = await db
      .insert(requestsTable)
      .values({
        homeLocation: data.homeLocation,
        workLocation: data.workLocation,
        homeLat: data.homeLat ?? null,
        homeLng: data.homeLng ?? null,
        destLat: data.destLat ?? null,
        destLng: data.destLng ?? null,
        distanceKm,
        durationMinutes,
        coordinates: routing.coordinates,
        routePolyline: routing.routePolyline,
        pricingSnapshot: routing.pricingSnapshot,
        needsAdminReview,
        phone: client.mobile, // Use client's registered mobile number
        numberOfPeople: data.numberOfPeople,
        workingDaysPerWeek: data.workingDaysPerWeek,
        numberOfShifts: data.numberOfShifts ?? 1,
        morningTime: data.morningTime,
        eveningTime: data.eveningTime,
        shifts: (data.shifts as { label?: string; goTime: string; returnTime?: string }[] | undefined) ?? null,
        additionalLocations: data.additionalLocations as { type: "pickup" | "dropoff"; address: string }[] | undefined,
        notes: data.notes,
        clientType: data.clientType ?? "غيره",
        monthlyPrice,
        clientId,
        status: initialStatus,
      })
      .returning();

    // Insert per-passenger records if provided
    if (hasPassengers) {
      const passengers = passengersInput!;
      const passengerRouteMap = new Map(
        routing.passengerRoutes.map((route) => [route.passengerIndex, route.route.distanceKm])
      );
      await db.insert(requestPassengersTable).values(
        passengers.map((p) => ({
          requestId: created.id,
          passengerIndex: p.passengerIndex,
          pickupLat: p.pickupLat ?? null,
          pickupLng: p.pickupLng ?? null,
          destinationLat: p.destinationLat ?? null,
          destinationLng: p.destinationLng ?? null,
          pickupAddress: p.pickupAddress ?? null,
          destinationAddress: p.destinationAddress ?? null,
          workTime: p.workTime ?? null,
          daysPerWeek: p.daysPerWeek ?? null,
            distanceKm: passengerRouteMap.get(p.passengerIndex) ?? null,
         }))
       );
     }

     // Insert multi-stop waypoints if provided
    if (stopsInput.length > 0) {
      await db.insert(requestStopsTable).values(
        stopsInput.map(s => ({
          requestId: created.id,
          stopOrder: s.stopOrder,
          lat: s.lat,
          lng: s.lng,
          address: s.address,
          stopType: s.stopType ?? "waypoint",
        }))
      );
    }

    await logActivity({
      actorId:   clientId,
      actorRole: "client",
      action:    "request.created",
      entity:    "requests",
      entityId:  created.id,
      metadata:  { homeLocation: created.homeLocation, workLocation: created.workLocation, distanceKm, monthlyPrice },
      req,
    });

    // Notify all admins about the new request
    void notifyAllAdmins({
      title: "📦 طلب نقل جديد",
      message: `طلب جديد من ${created.homeLocation} إلى ${created.workLocation}`,
      type: "request",
      relatedId: created.id,
      url: `/admin/requests/${created.id}`,
    });

    // Notify all active drivers so they can place an offer
    void notifyAllDrivers({
      title: "🚗 طلب نقل جديد متاح",
      message: `طلب من ${created.homeLocation} إلى ${created.workLocation} — قدّم عرضك الآن`,
      type: "request",
      relatedId: created.id,
      url: `/driver/requests`,
    });

    res.status(201).json(formatRequest(req, created, null));
  } catch (err) {
    logger.error({ err }, "requests POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id/stops", requireAuth(), async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صالح" }); return; }
  try {
    const stops = await db.select().from(requestStopsTable)
      .where(eq(requestStopsTable.requestId, id))
      .orderBy(requestStopsTable.stopOrder);
    res.json(stops);
  } catch (err) {
    logger.error({ err }, "GET request stops error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id", requireAuth(), async (req, res) => {
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
    const client =
      sessionUser?.role === "admin" && request.clientId
        ? await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, request.clientId) })
        : null;

    res.json(formatRequest(req, request, driver, client));
  } catch (err) {
    logger.error({ err }, "requests GET /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id/client", requireAuth("client"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const parsed = CreateRequestBody.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "بيانات التعديل غير صحيحة" });
    return;
  }

  try {
    const clientId = getSessionUser(req)!.id;
    const existing = await db.query.requestsTable.findFirst({ where: eq(requestsTable.id, id) });
    if (!existing) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    if (existing.clientId === null || existing.clientId !== clientId) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }
    if (existing.selectedDriverId != null || (existing.status !== "OPEN" && existing.status !== "FROZEN")) {
      res.status(400).json({ error: "لا يمكن تعديل الطلب بعد اختيار سائق" });
      return;
    }

    const next = { ...existing, ...parsed.data };
    const routing = await resolveRequestRoutingAndPricing({
      homeLat: next.homeLat ?? null,
      homeLng: next.homeLng ?? null,
      homeLocation: next.homeLocation,
      destLat: next.destLat ?? null,
      destLng: next.destLng ?? null,
      workLocation: next.workLocation,
      additionalLocations:
        (next.additionalLocations as { type: "pickup" | "dropoff"; address: string }[] | undefined) ?? null,
      numberOfPeople: next.numberOfPeople ?? 1,
      workingDaysPerWeek: next.workingDaysPerWeek ?? 5,
      numberOfShifts: next.numberOfShifts ?? 1,
      eveningTime: next.eveningTime ?? null,
      shifts: (next.shifts as { label?: string; goTime: string; returnTime?: string }[] | undefined) ?? null,
    });
    const distanceKm = routing.distanceKm;
    const monthlyPrice = routing.pricing?.price ?? toNum(existing.monthlyPrice);
    const needsAdminReview = false;

    const resolved = resolveRequestStatus({
      currentStatus: existing.status as RequestStatus,
      selectedDriverId: existing.selectedDriverId,
      needsAdminReview,
      event: "client_request_updated",
    });

    const [updated] = await db
      .update(requestsTable)
      .set({
        homeLocation: next.homeLocation,
        workLocation: next.workLocation,
        homeLat: next.homeLat ?? null,
        homeLng: next.homeLng ?? null,
        destLat: next.destLat ?? null,
        destLng: next.destLng ?? null,
        distanceKm,
        durationMinutes: routing.durationMinutes,
        coordinates: routing.coordinates,
        routePolyline: routing.routePolyline,
        pricingSnapshot: routing.pricingSnapshot,
        additionalLocations:
          (next.additionalLocations as { type: "pickup" | "dropoff"; address: string }[] | undefined) ?? null,
        shifts: (next.shifts as { label?: string; goTime?: string; returnTime?: string }[] | undefined) ?? null,
        phone: next.phone,
        numberOfPeople: next.numberOfPeople,
        workingDaysPerWeek: next.workingDaysPerWeek,
        numberOfShifts: next.numberOfShifts ?? 1,
        morningTime: next.morningTime,
        eveningTime: next.eveningTime ?? null,
        notes: next.notes ?? null,
        clientType: next.clientType ?? existing.clientType,
        monthlyPrice,
        needsAdminReview,
        status: resolved.status,
        statusManuallySetByAdmin: false,
        archivedAt: buildArchivedAt(resolved.status, existing.archivedAt),
        updatedAt: new Date(),
      })
      .where(and(eq(requestsTable.id, id), eq(requestsTable.clientId, clientId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    logRequestStatusTransition({
      requestId: id,
      previousStatus: existing.status as RequestStatus,
      nextStatus: updated.status as RequestStatus,
      reason: resolved.reason,
      event: "client_request_updated",
    });

    await logActivity({
      actorId: clientId,
      actorRole: "client",
      action: "request.updated_by_client",
      entity: "requests",
      entityId: id,
      metadata: { previousStatus: existing.status, newStatus: updated.status },
      req,
    });

    res.json(formatRequest(req, updated, null));
  } catch (err) {
    logger.error({ err }, "requests PATCH /:id/client error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/:id/cancel", requireAuth("client"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const clientId = getSessionUser(req)!.id;
    const existing = await db.query.requestsTable.findFirst({ where: eq(requestsTable.id, id) });
    if (!existing) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    if (existing.clientId === null || existing.clientId !== clientId) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }
    if (existing.selectedDriverId != null || (existing.status !== "OPEN" && existing.status !== "FROZEN")) {
      res.status(400).json({ error: "لا يمكن إلغاء الطلب بعد اختيار سائق" });
      return;
    }

    const [updated] = await db
      .update(requestsTable)
      .set({
        status: "CANCELLED",
        statusManuallySetByAdmin: false,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(requestsTable.id, id), eq(requestsTable.clientId, clientId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    logRequestStatusTransition({
      requestId: id,
      previousStatus: existing.status as RequestStatus,
      nextStatus: "CANCELLED",
      reason: "client_cancelled_before_driver_selection",
      event: "background_sync",
    });

    await logActivity({
      actorId: clientId,
      actorRole: "client",
      action: "request.cancelled_by_client",
      entity: "requests",
      entityId: id,
      metadata: { previousStatus: existing.status, newStatus: "CANCELLED" },
      req,
    });

    void notifyAllAdmins({
      title: "تم إلغاء الطلب",
      message: `ألغى العميل الطلب #${id}`,
      type: "request",
      relatedId: id,
      url: `/admin/requests/${id}`,
    });

    res.json(formatRequest(req, updated, null));
  } catch (err) {
    logger.error({ err }, "requests POST /:id/cancel error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/:id/archive", requireAuth("client"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const clientId = getSessionUser(req)!.id;
    const existing = await db.query.requestsTable.findFirst({ where: eq(requestsTable.id, id) });
    if (!existing) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }
    if (existing.clientId === null || existing.clientId !== clientId) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }

    const [updated] = await db
      .update(requestsTable)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(requestsTable.id, id), eq(requestsTable.clientId, clientId)))
      .returning();

    let driver = null;
    if (updated?.selectedDriverId) {
      driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, updated.selectedDriverId),
      });
    }

    await logActivity({
      actorId: clientId,
      actorRole: "client",
      action: "request.archived_by_client",
      entity: "requests",
      entityId: id,
      metadata: { status: updated?.status ?? existing.status },
      req,
    });

    res.json(formatRequest(req, updated ?? existing, driver));
  } catch (err) {
    logger.error({ err }, "requests POST /:id/archive error");
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
    const existing = await db.query.requestsTable.findFirst({
      where: eq(requestsTable.id, id),
    });
    if (!existing) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const nextStatus = parsed.data.status as RequestStatus;
    const reason =
      nextStatus === existing.status
        ? "admin_manual_override_same_status"
        : "admin_manual_override";

    const [updated] = await db
      .update(requestsTable)
      .set({
        status: nextStatus,
        statusManuallySetByAdmin: true,
        archivedAt: buildArchivedAt(nextStatus),
        updatedAt: new Date(),
      })
      .where(eq(requestsTable.id, id))
      .returning();

    logRequestStatusTransition({
      requestId: id,
      previousStatus: existing.status as RequestStatus,
      nextStatus: updated.status as RequestStatus,
      reason,
      event: "admin_manual_override",
    });

    await logActivity({
      actorId: getSessionUser(req)?.id,
      actorRole: "admin",
      action: "request.status_changed",
      entity: "requests",
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: updated.status,
        reason,
        sourceEvent: "admin_manual_override",
      },
      req,
    });

    let driver = null;
    if (updated.selectedDriverId) {
      driver = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, updated.selectedDriverId),
      });
    }

    if (existing.clientId) {
      const clientMessage =
        nextStatus === "ACTIVE"
          ? "وصل السائق إلى طلبك وتم تحديث الحالة."
          : nextStatus === "COMPLETED"
          ? "تم إتمام الطلب بنجاح."
          : nextStatus === "CANCELLED"
          ? "تم إلغاء الطلب."
          : `تم تحديث حالة الطلب إلى ${nextStatus}.`;
      void notify({
        userId: existing.clientId,
        userRole: "client",
        title: "تحديث حالة الطلب",
        message: clientMessage,
        type: "request",
        relatedId: id,
        url: `/client/request/${id}`,
      });
    }

    if (updated.selectedDriverId) {
      const driverMessage =
        nextStatus === "ACTIVE"
          ? "تم تسجيل وصولك للطلب."
          : nextStatus === "COMPLETED"
          ? "تم إغلاق الطلب كمكتمل."
          : nextStatus === "CANCELLED"
          ? "تم إلغاء الطلب."
          : `تم تحديث حالة الطلب إلى ${nextStatus}.`;
      void notify({
        userId: updated.selectedDriverId,
        userRole: "driver",
        title: "تحديث حالة الطلب",
        message: driverMessage,
        type: "request",
        relatedId: id,
        url: `/driver/request/${id}`,
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
  const clientId = getSessionUser(req)!.id;
  try {
    const { existingRequest, updated, updatedDriver } = await withDbTransaction(async (tx, meta) => {
      const existingRequest = await tx.query.requestsTable.findFirst({
        where: eq(requestsTable.id, id),
      });
      if (!existingRequest) {
        throw Object.assign(new Error("الطلب غير موجود"), { status: 404 });
      }

      if (existingRequest.clientId == null || existingRequest.clientId !== clientId) {
        throw Object.assign(new Error("غير مصرح بهذا الإجراء"), { status: 403 });
      }

      if (existingRequest.status !== "OPEN") {
        throw Object.assign(new Error("لا يمكن تأكيد سائق بعد اختيار سائق آخر"), { status: 400 });
      }

      const bidFee = await getBidFee();
      const offer = await tx.query.offersTable.findFirst({
        where: and(eq(offersTable.id, offerId), eq(offersTable.requestId, id)),
      });
      if (!offer) {
        throw Object.assign(new Error("العرض غير موجود لهذا الطلب"), { status: 404 });
      }

      // Re-check offer status inside transaction to prevent race with cancellation
      if (offer.status !== "PENDING") {
        throw Object.assign(
          new Error("لا يمكن اختيار هذا العرض - الحالة الحالية: " + offer.status),
          { status: 400 }
        );
      }

      const driver = await tx.query.driversTable.findFirst({
        where: eq(driversTable.id, offer.driverId),
      });
      if (!driver) {
        throw Object.assign(new Error("السائق غير موجود"), { status: 404 });
      }

      if (toNum(driver.balance) < bidFee) {
        throw Object.assign(new Error("رصيد السائق غير كافٍ للقبول على هذا الطلب"), { status: 400 });
      }

      // Atomic balance deduction with WHERE clause to prevent negative balance
      // This protects against race conditions even if multiple selections happen concurrently
      const [updatedDriver] = await tx
        .update(driversTable)
        .set({ balance: sql`${driversTable.balance} - ${bidFee}::numeric` })
        .where(and(
          eq(driversTable.id, driver.id),
          sql`${driversTable.balance} >= ${bidFee}::numeric` // Critical: prevents negative balance
        ))
        .returning();

      if (!updatedDriver) {
        logger.warn(
          { requestId: id, offerId, driverId: driver.id, currentBalance: driver.balance, requiredFee: bidFee },
          "requests POST /:id/select-offer balance deduction failed due to insufficient balance or concurrent modification",
        );
        throw Object.assign(new Error("تعذر خصم الرسوم من رصيد السائق؛ قد يكون الرصيد غير كافٍ أو تغيّر أثناء التنفيذ"), { status: 400 });
      }

      const { status: nextStatus, reason } = resolveRequestStatus({
        currentStatus: existingRequest.status as RequestStatus,
        selectedDriverId: driver.id,
        needsAdminReview: existingRequest.needsAdminReview,
        event: "offer_selected",
      });

      const [updated] = await tx
        .update(requestsTable)
        .set({
          status: nextStatus,
          selectedDriverId: driver.id,
          statusManuallySetByAdmin: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(requestsTable.id, id),
            eq(requestsTable.clientId, clientId),
            eq(requestsTable.status, "OPEN"),
          ),
        )
        .returning();

      if (!updated) {
        if (!meta.hasRealTransaction) {
          await tx
            .update(driversTable)
            .set({ balance: driver.balance })
            .where(eq(driversTable.id, driver.id));
        }
        throw Object.assign(new Error("تم تحديث الطلب من جلسة أخرى، يرجى إعادة المحاولة"), { status: 409 });
      }

      try {
        // Record bid-fee deduction in the ledger
        await tx.insert(transactionsTable).values({
          driverId: driver.id,
          amount: String(-bidFee),
          type: "fee",
        });

        // Advance offer state machine: selected offer → SELECTED, all others → CANCELLED
        await tx
          .update(offersTable)
          .set({ status: "SELECTED" })
          .where(and(eq(offersTable.id, offerId), eq(offersTable.requestId, id)));

        await tx
          .update(offersTable)
          .set({ status: "CANCELLED" })
          .where(
            and(
              eq(offersTable.requestId, id),
              ne(offersTable.id, offerId),
              eq(offersTable.status, "PENDING"),
            ),
          );
      } catch (err) {
        if (!meta.hasRealTransaction) {
          await tx
            .update(driversTable)
            .set({ balance: driver.balance })
            .where(eq(driversTable.id, driver.id));
          await tx
            .update(requestsTable)
            .set({
              status: existingRequest.status,
              selectedDriverId: existingRequest.selectedDriverId ?? null,
              updatedAt: existingRequest.updatedAt ?? new Date(),
            })
            .where(eq(requestsTable.id, id));
        }
        throw err;
      }

      logRequestStatusTransition({
        requestId: id,
        previousStatus: existingRequest.status as RequestStatus,
        nextStatus,
        reason,
        event: "offer_selected",
      });

      return { existingRequest, updated, updatedDriver };
    });

    // Notify the selected driver (outside transaction — non-critical side-effect)
    void notify({
      userId: updatedDriver.id,
      userRole: "driver",
      title: "🎉 تم اختيارك!",
      message: `اختار العميل عرضك على الطلب من ${existingRequest.homeLocation} إلى ${existingRequest.workLocation} بسعر ${toNum(existingRequest.monthlyPrice).toFixed(0)} ر.س/شهر`,
      type: "request",
      relatedId: existingRequest.id,
      url: `/driver/request/${existingRequest.id}`,
    });

    // Notify drivers whose offers were cancelled (fire-and-forget).
    // Offers were already set to CANCELLED inside the transaction, so querying
    // for CANCELLED offers (excluding the winner) gives us the correct set.
    void (async () => {
      try {
        const rejectedOffers = await db
          .select({ driverId: offersTable.driverId })
          .from(offersTable)
          .where(
            and(
              eq(offersTable.requestId, existingRequest.id),
              eq(offersTable.status, "CANCELLED"),
              ne(offersTable.driverId, updatedDriver.id),
            )
          );
        await Promise.all(
          rejectedOffers.map((o) =>
            notify({
              userId: o.driverId,
              userRole: "driver",
              title: "😔 لم يتم اختيارك",
              message: `تم اختيار سائق آخر للطلب من ${existingRequest.homeLocation} إلى ${existingRequest.workLocation}`,
              type: "request",
              relatedId: existingRequest.id,
              url: `/driver/requests`,
            })
          )
        );
      } catch (err) {
        // Non-critical — log but don't rethrow
        logger.warn({ err, requestId: existingRequest.id }, "select-offer: failed to notify rejected drivers");
      }
    })();

    res.json(formatRequest(req, updated, updatedDriver));
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 403 || status === 404 || status === 409) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    logger.error({ err }, "requests POST /:id/select-offer error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id/offers", requireAuth(), async (req, res) => {
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
  if (status !== undefined && !ALL_STATUSES.has(status as string)) {
    res.status(400).json({ error: "قيمة الحالة غير صحيحة" });
    return;
  }
  if (selectedDriverId !== undefined) updates.selectedDriverId = selectedDriverId;

  // `status` is not added to `updates` here — the engine resolves it later.
  // The check covers two rejection paths:
  //   1. No OTHER field updates (selectedDriverId) AND
  //   2. No `status` payload was provided either.
  if (Object.keys(updates).length === 0 && status === undefined) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }
  try {
    const existing = await db.query.requestsTable.findFirst({
      where: eq(requestsTable.id, id),
    });
    if (!existing) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    let reason = "admin_request_updated";
    let statusEvent: "selected_driver_assigned" | "admin_request_updated" | "admin_manual_override" =
      "admin_request_updated";
    if (status !== undefined) {
      updates.status = status;
      updates.statusManuallySetByAdmin = true;
      statusEvent = "admin_manual_override";
      reason = status === existing.status ? "admin_manual_override_same_status" : "admin_manual_override";
    } else {
      const effectiveSelectedDriverId =
        selectedDriverId !== undefined ? (selectedDriverId as number | null) : existing.selectedDriverId;
      statusEvent =
        selectedDriverId !== undefined && effectiveSelectedDriverId != null
          ? "selected_driver_assigned"
          : "admin_request_updated";
      const resolved = resolveRequestStatus({
        currentStatus: existing.status as RequestStatus,
        selectedDriverId: effectiveSelectedDriverId,
        needsAdminReview: existing.needsAdminReview,
        event: statusEvent,
      });
      updates.status = resolved.status;
      updates.statusManuallySetByAdmin = false;
      reason = resolved.reason;
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(requestsTable)
      .set(updates)
      .where(eq(requestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    logRequestStatusTransition({
      requestId: id,
      previousStatus: existing.status as RequestStatus,
      nextStatus: updated.status as RequestStatus,
      reason,
      event: statusEvent,
    });

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

router.delete("/:id", requireAuth("admin"), requireHardDeleteApproval, async (req, res) => {
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
