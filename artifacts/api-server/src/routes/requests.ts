import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  transactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateRequestBody,
  UpdateRequestStatusBody,
  SelectOfferBody,
  ListRequestsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";

const router = Router();

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
    (r.status === "SELECTED" || r.status === "ACTIVE")
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
  const showDriverContact =
    user?.role === "admin" ||
    (user?.role === "client" &&
      r.clientId === user.id &&
      (r.status === "SELECTED" || r.status === "ACTIVE"));
  return {
    id: r.id,
    clientId: r.clientId,
    homeLocation: r.homeLocation,
    workLocation: r.workLocation,
    phone: showPhone ? r.phone : null,
    phoneHidden: !showPhone,
    numberOfPeople: r.numberOfPeople,
    workingDaysPerWeek: r.workingDaysPerWeek,
    morningTime: r.morningTime,
    eveningTime: r.eveningTime,
    status: r.status,
    selectedDriverId: r.selectedDriverId,
    selectedDriver: driver ? formatDriver(driver, showDriverContact) : null,
    createdAt: r.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const parsed = ListRequestsQueryParams.safeParse(req.query);
  const status = parsed.success ? parsed.data.status : undefined;

  const rows = status
    ? await db
        .select()
        .from(requestsTable)
        .where(
          eq(
            requestsTable.status,
            status as "OPEN" | "SELECTED" | "ACTIVE" | "COMPLETED"
          )
        )
        .orderBy(requestsTable.createdAt)
    : await db.select().from(requestsTable).orderBy(requestsTable.createdAt);

  const results = await Promise.all(
    rows.map(async (r) => {
      if (r.selectedDriverId) {
        const driver = await db.query.driversTable.findFirst({
          where: eq(driversTable.id, r.selectedDriverId),
        });
        return formatRequest(req, r, driver);
      }
      return formatRequest(req, r, null);
    })
  );

  res.json(results);
});

router.post("/", requireAuth("client"), async (req, res) => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const clientId = req.session.user!.id;

  const [created] = await db
    .insert(requestsTable)
    .values({
      ...parsed.data,
      clientId,
      status: "OPEN",
    })
    .returning();

  res.status(201).json(formatRequest(req, created, null));
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, id),
  });

  if (!request) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }

  let driver = null;
  if (request.selectedDriverId) {
    driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, request.selectedDriverId),
    });
  }

  res.json(formatRequest(req, request, driver));
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

  const [updated] = await db
    .update(requestsTable)
    .set({
      status: parsed.data.status as
        | "OPEN"
        | "SELECTED"
        | "ACTIVE"
        | "COMPLETED",
    })
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
    res.status(400).json({ error: "الطلب ليس مفتوحاً للعروض" });
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
    .set({ balance: driver.balance - 50 })
    .where(eq(driversTable.id, driver.id));

  await db.insert(transactionsTable).values({
    driverId: driver.id,
    amount: -50,
    type: "DEBIT",
  });

  const [updated] = await db
    .update(requestsTable)
    .set({ status: "SELECTED", selectedDriverId: driver.id })
    .where(eq(requestsTable.id, id))
    .returning();

  const updatedDriver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, driver.id),
  });

  res.json(formatRequest(req, updated, updatedDriver));
});

router.get("/:id/offers", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

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
    request.status === "SELECTED" || request.status === "ACTIVE";

  const offers = await db
    .select()
    .from(offersTable)
    .where(eq(offersTable.requestId, id))
    .orderBy(offersTable.price);

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
        price: o.price,
        carType: o.carType,
        nationality: o.nationality,
        driver: driver ? formatDriver(driver, revealMobile) : null,
        createdAt: o.createdAt?.toISOString(),
      };
    })
  );

  res.json(results);
});

router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status, selectedDriverId } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (status !== undefined)
    updates.status = status as "OPEN" | "SELECTED" | "ACTIVE" | "COMPLETED";
  if (selectedDriverId !== undefined) updates.selectedDriverId = selectedDriverId;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }

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
});

router.delete("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const deleted = await db
    .delete(requestsTable)
    .where(eq(requestsTable.id, id))
    .returning();
  if (!deleted.length) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json({ message: "تم حذف الطلب" });
});

export default router;
