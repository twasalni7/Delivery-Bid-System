import { Router } from "express";
import { db } from "@workspace/db";
import { driversTable, transactionsTable, requestsTable } from "@workspace/db";
import { eq, ne, sql, isNull, isNotNull, and } from "drizzle-orm";
import { AddDriverBalanceBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

/** Convert a numeric-column string (Drizzle returns numeric as string) to JS number. */
function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

router.get("/", requireAuth("admin"), async (_req, res) => {
  try {
    const drivers = await db
      .select()
      .from(driversTable)
      .where(ne(driversTable.status, "DELETED"))
      .orderBy(driversTable.createdAt);
    res.json(
      drivers.map((d) => ({
        id: d.id,
        name: d.name,
        balance: toNum(d.balance),
        carType: d.carType,
        nationality: d.nationality,
        status: d.status,
        warningCount: d.warningCount,
        createdAt: d.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "drivers GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/me", requireAuth("driver"), async (req, res) => {
  try {
    const driverId = getSessionUser(req)!.id;
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
      balance: toNum(driver.balance),
      carType: driver.carType,
      nationality: driver.nationality,
      age: driver.age,
      nationalId: driver.nationalId,
      status: driver.status,
      warningCount: driver.warningCount,
      createdAt: driver.createdAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "drivers GET /me error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/me/requests", requireAuth("driver"), async (req, res) => {
  try {
    const driverId = getSessionUser(req)!.id;
    const archived = String(req.query["archived"] ?? "").toLowerCase() === "true";
    const rows = await db
      .select()
      .from(requestsTable)
      .where(
        and(
          eq(requestsTable.selectedDriverId, driverId),
          archived ? isNotNull(requestsTable.archivedAt) : isNull(requestsTable.archivedAt)
        )
      )
      .orderBy(requestsTable.createdAt);
    res.json(
      rows.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        homeLocation: r.homeLocation,
        workLocation: r.workLocation,
        homeLat: r.homeLat,
        homeLng: r.homeLng,
        destLat: r.destLat,
        destLng: r.destLng,
        distanceKm: r.distanceKm,
        durationMinutes: r.durationMinutes,
        coordinates: r.coordinates,
        routePolyline: r.routePolyline,
        pricingSnapshot: r.pricingSnapshot,
        numberOfPeople: r.numberOfPeople,
        workingDaysPerWeek: r.workingDaysPerWeek,
        morningTime: r.morningTime,
        eveningTime: r.eveningTime,
        shifts: r.shifts,
        monthlyPrice: toNum(r.monthlyPrice),
        status: r.status,
        selectedDriverId: r.selectedDriverId,
        phone: r.phone,
        archivedAt: r.archivedAt?.toISOString() ?? null,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "drivers GET /me/requests error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, id),
    });

    if (!driver || driver.status === "DELETED") {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    res.json({
      id: driver.id,
      name: driver.name,
      balance: toNum(driver.balance),
      carType: driver.carType,
      nationality: driver.nationality,
      status: driver.status,
      warningCount: driver.warningCount,
      createdAt: driver.createdAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "drivers GET /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id/balance", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
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
  try {
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, id),
    });

    if (!driver) {
      res.status(404).json({ error: "السائق غير موجود" });
      return;
    }

    // Use SQL expression to avoid JS float arithmetic on numeric columns
    const [updated] = await db
      .update(driversTable)
      .set({ balance: sql`${driversTable.balance} + ${amount}::numeric` })
      .where(eq(driversTable.id, id))
      .returning();

    await db.insert(transactionsTable).values({
      driverId: id,
      amount: String(amount),
      type: "credit",
    });

    await logActivity({
      actorId:   getSessionUser(req)?.id,
      actorRole: "admin",
      action:    "driver.balance_credited",
      entity:    "drivers",
      entityId:  id,
      metadata:  { amount },
      req,
    });

    res.json({
      id: updated.id,
      name: updated.name,
      balance: toNum(updated.balance),
      carType: updated.carType,
      nationality: updated.nationality,
      status: updated.status,
      createdAt: updated.createdAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "drivers PATCH /:id/balance error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/:id/transactions", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.driverId, id))
      .orderBy(transactionsTable.createdAt);

    res.json(
      txns.map((t) => ({
        id: t.id,
        driverId: t.driverId,
        amount: toNum(t.amount),
        type: t.type,
        createdAt: t.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "drivers GET /:id/transactions error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
