import { Router } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  adminsTable,
  clientsTable,
  transactionsTable,
} from "@workspace/db";
import { eq, count, ne, desc, sql, sum } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { generateLoginCode } from "../lib/auth";

const VALID_REQUEST_STATUSES = new Set([
  "OPEN",
  "SELECTED",
  "ACTIVE",
  "COMPLETED",
]);

async function generateUniqueLoginCode(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateLoginCode();
    const existing = await db.query.driversTable.findFirst({
      where: eq(driversTable.loginCode, code),
    });
    if (!existing) return code;
  }
  throw new Error("فشل توليد رمز فريد، يرجى المحاولة مرة أخرى");
}

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

router.get("/financial", async (_req, res) => {
  const acceptedStatuses = ["SELECTED", "ACTIVE", "COMPLETED"] as const;
  let acceptedContractsCount = 0;
  for (const status of acceptedStatuses) {
    const [result] = await db
      .select({ count: count() })
      .from(requestsTable)
      .where(eq(requestsTable.status, status));
    acceptedContractsCount += Number(result.count);
  }
  const totalFeesCollected = acceptedContractsCount * 50;

  let totalTransactionsAmount = 0;
  try {
    const [txSum] = await db
      .select({ total: sum(transactionsTable.amount) })
      .from(transactionsTable);
    totalTransactionsAmount = Number(txSum?.total ?? 0);
  } catch {
    totalTransactionsAmount = 0;
  }

  const drivers = await db
    .select({
      id: driversTable.id,
      name: driversTable.name,
      balance: driversTable.balance,
    })
    .from(driversTable)
    .where(ne(driversTable.status, "DELETED"))
    .orderBy(desc(driversTable.balance));

  const totalDriversBalance = drivers.reduce((acc, d) => acc + (d.balance ?? 0), 0);

  res.json({
    totalFeesCollected,
    totalTransactionsAmount,
    totalDriversBalance,
    acceptedContractsCount,
    driverBalances: drivers.map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance ?? 0,
    })),
  });
});

router.get("/analytics", async (req, res) => {
  const rawFrom = req.query["from"] as string | undefined;
  const rawTo = req.query["to"] as string | undefined;

  let timeFilter;
  if (rawFrom && rawTo) {
    const fromDate = new Date(rawFrom);
    const toDate = new Date(rawTo);
    toDate.setHours(23, 59, 59, 999);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ error: "تاريخ غير صحيح" });
      return;
    }
    if (fromDate > toDate) {
      res.status(400).json({ error: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" });
      return;
    }
    timeFilter = sql`${requestsTable.createdAt} >= ${fromDate.toISOString()} AND ${requestsTable.createdAt} <= ${toDate.toISOString()}`;
  } else {
    const rawMonths = Number(req.query["months"]);
    const months = [3, 6, 12].includes(rawMonths) ? rawMonths : 12;
    timeFilter = sql`${requestsTable.createdAt} > NOW() - INTERVAL '1 month' * ${months}`;
  }

  const monthlyRequests = await db
    .select({
      year: sql<number>`EXTRACT(year FROM ${requestsTable.createdAt})::int`,
      month: sql<number>`EXTRACT(month FROM ${requestsTable.createdAt})::int`,
      count: count(),
    })
    .from(requestsTable)
    .where(timeFilter)
    .groupBy(
      sql`EXTRACT(year FROM ${requestsTable.createdAt})`,
      sql`EXTRACT(month FROM ${requestsTable.createdAt})`
    )
    .orderBy(
      sql`EXTRACT(year FROM ${requestsTable.createdAt})`,
      sql`EXTRACT(month FROM ${requestsTable.createdAt})`
    );

  const topDrivers = await db
    .select({
      id: driversTable.id,
      name: driversTable.name,
      acceptedBids: count(requestsTable.id),
    })
    .from(driversTable)
    .innerJoin(requestsTable, eq(requestsTable.selectedDriverId, driversTable.id))
    .where(timeFilter)
    .groupBy(driversTable.id, driversTable.name)
    .orderBy(desc(count(requestsTable.id)))
    .limit(10);

  const [openCount] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(sql`${requestsTable.status} = 'OPEN' AND ${timeFilter}`);

  const [selectedCount] = await db
    .select({ count: count() })
    .from(requestsTable)
    .where(sql`${requestsTable.status} != 'OPEN' AND ${timeFilter}`);

  res.json({
    monthlyRequests: monthlyRequests.map((r) => ({
      year: r.year,
      month: r.month,
      count: Number(r.count),
    })),
    requestStatusSplit: {
      selected: Number(selectedCount.count),
      open: Number(openCount.count),
    },
    topDrivers: topDrivers.map((d) => ({
      id: d.id,
      name: d.name,
      acceptedBids: Number(d.acceptedBids),
    })),
  });
});

router.get("/drivers", async (req, res) => {
  const showDeleted = req.query["status"] === "DELETED";
  const drivers = await db
    .select()
    .from(driversTable)
    .where(showDeleted ? eq(driversTable.status, "DELETED") : ne(driversTable.status, "DELETED"))
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

  const loginCode = await generateUniqueLoginCode();

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

router.post("/drivers/import", async (req, res) => {
  const { drivers } = req.body ?? {};
  if (!Array.isArray(drivers) || drivers.length === 0) {
    res.status(400).json({ error: "لا توجد بيانات سائقين" });
    return;
  }
  if (drivers.length > 500) {
    res.status(400).json({ error: "الحد الأقصى 500 سائق لكل استيراد" });
    return;
  }

  const results: {
    created: { name: string; mobile: string; loginCode: string }[];
    skipped: { name: string; mobile: string; reason: string }[];
  } = { created: [], skipped: [] };

  const seenMobiles = new Set<string>();

  for (const row of drivers) {
    const name = String(row.name ?? "").trim();
    const mobile = String(row.mobile ?? "").trim();

    if (!name || !mobile) {
      results.skipped.push({ name: name || "—", mobile: mobile || "—", reason: "بيانات ناقصة (الاسم أو الجوال)" });
      continue;
    }
    if (seenMobiles.has(mobile)) {
      results.skipped.push({ name, mobile, reason: "رقم مكرر داخل الملف" });
      continue;
    }
    seenMobiles.add(mobile);

    const existing = await db.query.driversTable.findFirst({
      where: eq(driversTable.mobile, mobile),
    });
    if (existing) {
      results.skipped.push({ name, mobile, reason: "رقم الجوال مسجّل مسبقاً" });
      continue;
    }

    const rawCode = String(row.loginCode ?? row.pin ?? "").trim();
    let finalCode: string;
    if (rawCode) {
      const codeExists = await db.query.driversTable.findFirst({
        where: eq(driversTable.loginCode, rawCode),
      });
      finalCode = codeExists ? await generateUniqueLoginCode() : rawCode;
    } else {
      finalCode = await generateUniqueLoginCode();
    }

    const carTypeParts = [row.carType, row.carYear].filter(Boolean).join(" ");

    await db.insert(driversTable).values({
      name,
      mobile,
      loginCode: finalCode,
      carType: carTypeParts || null,
      nationality: row.nationality ? String(row.nationality) : null,
      age: row.age ? parseInt(String(row.age)) : null,
      nationalId: row.nationalId ?? row.national_id ? String(row.nationalId ?? row.national_id) : null,
      balance: 0,
    });

    results.created.push({ name, mobile, loginCode: finalCode });
  }

  res.json(results);
});

router.get("/drivers/:id", async (req, res) => {
  const id = Number(req.params["id"]);
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
  const id = Number(req.params["id"]);
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
  const id = Number(req.params["id"]);
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
  const id = Number(req.params["id"]);
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
  const id = Number(req.params["id"]);
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
  const [updated] = await db
    .update(driversTable)
    .set({ warningCount: (driver.warningCount ?? 0) + 1 })
    .where(eq(driversTable.id, id))
    .returning();
  res.json({
    message: "تم إضافة تحذير للسائق",
    warningCount: updated.warningCount,
  });
});

router.post("/drivers/:id/restore", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const [updated] = await db
    .update(driversTable)
    .set({ status: "ACTIVE", deletedAt: null })
    .where(eq(driversTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "السائق غير موجود" });
    return;
  }
  res.json({ message: "تم استعادة السائق", status: updated.status });
});

router.delete("/drivers/:id", async (req, res) => {
  const id = Number(req.params["id"]);
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
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const newCode = await generateUniqueLoginCode();
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

router.patch("/drivers/:id/balance", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { amount } = req.body ?? {};
  if (typeof amount !== "number") {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
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
  res.json({
    id: updated.id,
    name: updated.name,
    mobile: updated.mobile,
    balance: updated.balance,
    status: updated.status,
    createdAt: updated.createdAt?.toISOString(),
  });
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

router.patch("/requests/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status, selectedDriverId } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!VALID_REQUEST_STATUSES.has(status as string)) {
      res.status(400).json({ error: "قيمة الحالة غير صحيحة" });
      return;
    }
    updates.status = status as "OPEN" | "SELECTED" | "ACTIVE" | "COMPLETED";
  }
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
  res.json({
    id: updated.id,
    clientId: updated.clientId,
    homeLocation: updated.homeLocation,
    workLocation: updated.workLocation,
    phone: updated.phone,
    phoneHidden: false,
    numberOfPeople: updated.numberOfPeople,
    workingDaysPerWeek: updated.workingDaysPerWeek,
    morningTime: updated.morningTime,
    eveningTime: updated.eveningTime,
    status: updated.status,
    selectedDriverId: updated.selectedDriverId,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.delete("/requests/:id", async (req, res) => {
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

router.post("/change-code", async (req, res) => {
  const adminId = req.session.user!.id;
  const { newCode } = req.body ?? {};
  if (!newCode || typeof newCode !== "string" || newCode.trim().length < 6) {
    res.status(400).json({ error: "يجب أن يكون الرمز 6 أحرف أو أكثر" });
    return;
  }
  const existing = await db.query.adminsTable.findFirst({
    where: eq(adminsTable.loginCode, newCode.trim()),
  });
  if (existing && existing.id !== adminId) {
    res.status(400).json({ error: "هذا الرمز مستخدم مسبقاً" });
    return;
  }
  const [updated] = await db
    .update(adminsTable)
    .set({ loginCode: newCode.trim() })
    .where(eq(adminsTable.id, adminId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "المشرف غير موجود" });
    return;
  }
  res.json({ message: "تم تغيير الرمز السري بنجاح", loginCode: updated.loginCode });
});

router.post("/clients", async (req, res) => {
  const { name, mobile, password } = req.body ?? {};
  if (!name || !mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الاسم والجوال وكلمة المرور" });
    return;
  }
  const existing = await db.query.clientsTable.findFirst({
    where: eq(clientsTable.mobile, mobile),
  });
  if (existing) {
    res.status(400).json({ error: "رقم الجوال مسجّل مسبقاً" });
    return;
  }
  const { hashPassword } = await import("../lib/auth");
  const passwordHash = await hashPassword(password);
  const [client] = await db
    .insert(clientsTable)
    .values({ name, mobile, passwordHash })
    .returning();
  res.status(201).json({
    id: client.id,
    name: client.name,
    mobile: client.mobile,
    createdAt: client.createdAt?.toISOString(),
  });
});

router.patch("/clients/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { name, mobile, password } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (mobile) {
    const existing = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.mobile, mobile),
    });
    if (existing && existing.id !== id) {
      res.status(400).json({ error: "رقم الجوال مسجّل لعميل آخر" });
      return;
    }
    updates.mobile = mobile;
  }
  if (password) {
    const { hashPassword } = await import("../lib/auth");
    updates.passwordHash = await hashPassword(password);
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }
  const [updated] = await db
    .update(clientsTable)
    .set(updates)
    .where(eq(clientsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }
  res.json({
    id: updated.id,
    name: updated.name,
    mobile: updated.mobile,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.delete("/clients/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const deleted = await db
    .delete(clientsTable)
    .where(eq(clientsTable.id, id))
    .returning();
  if (!deleted.length) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }
  res.json({ message: "تم حذف العميل" });
});

export default router;
