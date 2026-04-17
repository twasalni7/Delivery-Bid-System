import { Router } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  adminsTable,
  clientsTable,
} from "@workspace/db";
import { eq, count, ne } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { generateLoginCode } from "../lib/auth";

const router = Router();

router.use(requireAuth("admin"));

router.get("/stats", async (_req, res) => {
  const [totalRequestsResult] = await db
    .select({ count: count() })
    .from(requestsTable);
  const [openResult] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(eq(requestsTable.status, "OPEN"));
  const [selectedResult] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(eq(requestsTable.status, "SELECTED"));
  const [activeResult] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(eq(requestsTable.status, "ACTIVE"));
  const [completedResult] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(eq(requestsTable.status, "COMPLETED"));
  const [totalDriversResult] = await db
    .select({ count: count() })
    .from(driversTable)
    .where(ne(driversTable.status, "DELETED"));
  const [totalOffersResult] = await db
    .select({ count: count() })
    .from(offersTable);
  const [totalClientsResult] = await db
    .select({ count: count() })
    .from(clientsTable);

  res.json({
    totalRequests: Number(totalRequestsResult.count),
    openRequests: Number(openResult.count),
    selectedRequests: Number(selectedResult.count),
    activeRequests: Number(activeResult.count),
    completedRequests: Number(completedResult.count),
    totalDrivers: Number(totalDriversResult.count),
    totalOffers: Number(totalOffersResult.count),
    totalClients: Number(totalClientsResult.count),
  });
});

router.get("/drivers", async (_req, res) => {
  const drivers = await db
    .select()
    .from(driversTable)
    .where(ne(driversTable.status, "DELETED"))
    .orderBy(driversTable.createdAt);
  res.json(
    drivers.map((d) => ({
      id: d.id,
      name: d.name,
      mobile: d.mobile,
      loginCode: d.loginCode,
      balance: d.balance,
      carType: d.carType,
      nationality: d.nationality,
      age: d.age,
      nationalId: d.nationalId,
      status: d.status,
      warningCount: d.warningCount,
      createdAt: d.createdAt?.toISOString(),
    }))
  );
});

router.post("/drivers", async (req, res) => {
  const { name, mobile, carType, nationality, age, nationalId } =
    req.body ?? {};
  if (!name || !mobile) {
    res.status(400).json({ error: "يرجى إدخال الاسم ورقم الجوال" });
    return;
  }

  const existing = await db.query.driversTable.findFirst({
    where: eq(driversTable.mobile, mobile),
  });
  if (existing) {
    res.status(400).json({ error: "رقم الجوال مسجّل مسبقاً" });
    return;
  }

  const loginCode = generateLoginCode();

  const [driver] = await db
    .insert(driversTable)
    .values({
      name,
      mobile,
      loginCode,
      carType: carType ?? null,
      nationality: nationality ?? null,
      age: age ? parseInt(age) : null,
      nationalId: nationalId ?? null,
      balance: 0,
    })
    .returning();

  res.status(201).json({
    id: driver.id,
    name: driver.name,
    mobile: driver.mobile,
    loginCode: driver.loginCode,
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

router.get("/drivers/:id", async (req, res) => {
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
    mobile: driver.mobile,
    loginCode: driver.loginCode,
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

router.patch("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { name, mobile, carType, nationality, age, nationalId } =
    req.body ?? {};

  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.id, id),
  });
  if (!driver) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (mobile !== undefined) updates.mobile = mobile;
  if (carType !== undefined) updates.carType = carType;
  if (nationality !== undefined) updates.nationality = nationality;
  if (age !== undefined) updates.age = age ? parseInt(age) : null;
  if (nationalId !== undefined) updates.nationalId = nationalId;

  const [updated] = await db
    .update(driversTable)
    .set(updates)
    .where(eq(driversTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    mobile: updated.mobile,
    loginCode: updated.loginCode,
    balance: updated.balance,
    carType: updated.carType,
    nationality: updated.nationality,
    age: updated.age,
    nationalId: updated.nationalId,
    status: updated.status,
    warningCount: updated.warningCount,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.post("/drivers/:id/block", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const [updated] = await db
    .update(driversTable)
    .set({ status: "BLOCKED" })
    .where(eq(driversTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({ message: "تم إيقاف السائق", status: updated.status });
});

router.post("/drivers/:id/unblock", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const [updated] = await db
    .update(driversTable)
    .set({ status: "ACTIVE" })
    .where(eq(driversTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({ message: "تم تفعيل السائق", status: updated.status });
});

router.post("/drivers/:id/warn", async (req, res) => {
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
  const newCount = (driver.warningCount ?? 0) + 1;
  const [updated] = await db
    .update(driversTable)
    .set({ warningCount: newCount })
    .where(eq(driversTable.id, id))
    .returning();
  res.json({ message: "تم إضافة تحذير للسائق", warningCount: updated.warningCount });
});

router.delete("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const [updated] = await db
    .update(driversTable)
    .set({ status: "DELETED", deletedAt: new Date() })
    .where(eq(driversTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({ message: "تم حذف السائق" });
});

router.post("/drivers/:id/regenerate-code", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const newCode = generateLoginCode();
  const [updated] = await db
    .update(driversTable)
    .set({ loginCode: newCode })
    .where(eq(driversTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({ loginCode: updated.loginCode });
});

router.get("/clients", async (_req, res) => {
  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      mobile: clientsTable.mobile,
      createdAt: clientsTable.createdAt,
    })
    .from(clientsTable)
    .orderBy(clientsTable.createdAt);
  res.json(
    clients.map((c) => ({
      ...c,
      createdAt: c.createdAt?.toISOString(),
    }))
  );
});

router.get("/requests", async (_req, res) => {
  const rows = await db
    .select()
    .from(requestsTable)
    .orderBy(requestsTable.createdAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      homeLocation: r.homeLocation,
      workLocation: r.workLocation,
      phone: r.phone,
      phoneHidden: false,
      numberOfPeople: r.numberOfPeople,
      workingDaysPerWeek: r.workingDaysPerWeek,
      morningTime: r.morningTime,
      eveningTime: r.eveningTime,
      status: r.status,
      selectedDriverId: r.selectedDriverId,
      createdAt: r.createdAt?.toISOString(),
    }))
  );
});

router.delete("/requests/:id", async (req, res) => {
  const id = parseInt(req.params.id);
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
