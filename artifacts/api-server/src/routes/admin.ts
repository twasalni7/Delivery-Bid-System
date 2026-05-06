import { Router } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  offersTable,
  adminsTable,
  clientsTable,
  transactionsTable,
  walletTransactionsTable,
  supportTicketsTable,
  ADMIN_REVIEW_DISTANCE_KM,
} from "@workspace/db";
import { eq, count, ne, desc, sql, sum, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { generateLoginCode } from "../lib/auth";
import { logger } from "../lib/logger";
import { CreateRequestBody } from "@workspace/api-zod";
import { notify } from "../lib/notify";
import { getSessionUser } from "../lib/session";
import { getBidFee } from "./pricing";
import { withDbTransaction } from "../lib/db-transaction";
import { normalizeDriverMobile } from "./auth";

const VALID_REQUEST_STATUSES = new Set([
  "OPEN",
  "SELECTED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "FROZEN",
]);

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

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
  try {
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
  } catch (err) {
    logger.error({ err }, "admin GET /stats error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/financial", async (_req, res) => {
  try {
    const acceptedStatuses = ["SELECTED", "ACTIVE", "COMPLETED"] as const;
    let acceptedContractsCount = 0;
    for (const status of acceptedStatuses) {
      const [result] = await db
        .select({ count: count() })
        .from(requestsTable)
        .where(eq(requestsTable.status, status));
      acceptedContractsCount += Number(result.count);
    }

    let totalFeesCollected = 0;
    let totalTransactionsAmount = 0;
    try {
      const [feeSum] = await db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(inArray(transactionsTable.type, ["fee", "debit"]));
      totalFeesCollected = Math.abs(Number(feeSum?.total ?? 0));

      const [txSum] = await db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable);
      totalTransactionsAmount = Number(txSum?.total ?? 0);
    } catch {
      totalFeesCollected = acceptedContractsCount * 50;
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

    const totalDriversBalance = drivers.reduce(
      (acc, d) => acc + parseFloat(d.balance ?? "0"),
      0,
    );

    res.json({
      totalFeesCollected,
      totalTransactionsAmount,
      totalDriversBalance,
      acceptedContractsCount,
      driverBalances: drivers.map((d) => ({
        id: d.id,
        name: d.name,
        balance: parseFloat(d.balance ?? "0"),
      })),
    });
  } catch (err) {
    logger.error({ err }, "admin GET /financial error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
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
      balance: parseFloat(d.balance ?? "0"),
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

  const normalizedMobile = normalizeDriverMobile(String(mobile));

  const existing = await db.query.driversTable.findFirst({
    where: eq(driversTable.mobile, normalizedMobile),
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
      mobile: normalizedMobile,
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
    balance: parseFloat(driver.balance ?? "0"),
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
    balance: parseFloat(driver.balance ?? "0"),
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
  if (mobile !== undefined) updates.mobile = normalizeDriverMobile(String(mobile));
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
    balance: parseFloat(updated.balance ?? "0"),
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
    .set({ balance: sql`${driversTable.balance} + ${amount}::numeric` })
    .where(eq(driversTable.id, id))
    .returning();
  await db.insert(transactionsTable).values({
    driverId: id,
    amount,
    type: amount >= 0 ? "credit" : "debit",
  });
  res.json({
    id: updated.id,
    name: updated.name,
    mobile: updated.mobile,
    balance: parseFloat(updated.balance ?? "0"),
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
      clientType: r.clientType,
      homeLocation: r.homeLocation,
      workLocation: r.workLocation,
      additionalLocations: r.additionalLocations,
      shifts: r.shifts,
      phone: r.phone,
      phoneHidden: false,
      numberOfPeople: r.numberOfPeople,
      workingDaysPerWeek: r.workingDaysPerWeek,
      numberOfShifts: r.numberOfShifts,
      morningTime: r.morningTime,
      eveningTime: r.eveningTime,
      notes: r.notes,
      monthlyPrice: r.monthlyPrice,
      status: r.status,
      selectedDriverId: r.selectedDriverId,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }))
  );
});

router.patch("/requests/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status, selectedDriverId, monthlyPrice, needsAdminReview } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!VALID_REQUEST_STATUSES.has(status as string)) {
      res.status(400).json({ error: "قيمة الحالة غير صحيحة" });
      return;
    }
    updates.status = status as typeof requestsTable.$inferSelect["status"];
  }
  if (selectedDriverId !== undefined) updates.selectedDriverId = selectedDriverId;
  if (monthlyPrice !== undefined) {
    const price = parseFloat(monthlyPrice);
    if (isNaN(price) || price < 0) {
      res.status(400).json({ error: "السعر الشهري غير صحيح" });
      return;
    }
    updates.monthlyPrice = price;
  }
  if (needsAdminReview !== undefined) updates.needsAdminReview = Boolean(needsAdminReview);

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
    clientType: updated.clientType,
    homeLocation: updated.homeLocation,
    workLocation: updated.workLocation,
    additionalLocations: updated.additionalLocations,
    shifts: updated.shifts,
    phone: updated.phone,
    phoneHidden: false,
    numberOfPeople: updated.numberOfPeople,
    workingDaysPerWeek: updated.workingDaysPerWeek,
    numberOfShifts: updated.numberOfShifts,
    morningTime: updated.morningTime,
    eveningTime: updated.eveningTime,
    notes: updated.notes,
    monthlyPrice: updated.monthlyPrice,
    status: updated.status,
    selectedDriverId: updated.selectedDriverId,
    createdAt: updated.createdAt?.toISOString(),
    updatedAt: updated.updatedAt?.toISOString(),
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
  const adminId = getSessionUser(req)!.id;
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

// POST /api/admin/requests — admin creates a request on behalf of a client
router.post("/requests", async (req, res) => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  // Admins may optionally assign a client and/or pre-select a driver
  const clientId = req.body?.clientId != null ? Number(req.body.clientId) : null;
  const selectedDriverId =
    req.body?.selectedDriverId != null ? Number(req.body.selectedDriverId) : null;

  try {
    const distanceKm = parsed.data.distanceKm ?? null;
    const needsAdminReview = distanceKm != null && distanceKm > ADMIN_REVIEW_DISTANCE_KM;

    const [created] = await db
      .insert(requestsTable)
      .values({
        homeLocation: parsed.data.homeLocation,
        workLocation: parsed.data.workLocation,
        homeLat: parsed.data.homeLat ?? null,
        homeLng: parsed.data.homeLng ?? null,
        destLat: parsed.data.destLat ?? null,
        destLng: parsed.data.destLng ?? null,
        distanceKm: distanceKm,
        needsAdminReview,
        phone: parsed.data.phone,
        numberOfPeople: parsed.data.numberOfPeople,
        workingDaysPerWeek: parsed.data.workingDaysPerWeek,
        numberOfShifts: parsed.data.numberOfShifts ?? 1,
        morningTime: parsed.data.morningTime,
        eveningTime: parsed.data.eveningTime,
        additionalLocations: parsed.data.additionalLocations as { type: "pickup" | "dropoff"; address: string }[] | undefined,
        notes: parsed.data.notes,
        clientType: parsed.data.clientType ?? "غيره",
        monthlyPrice: parsed.data.monthlyPrice ?? 0,
        clientId: Number.isFinite(clientId) ? clientId : null,
        selectedDriverId: Number.isFinite(selectedDriverId) ? selectedDriverId : null,
        status: selectedDriverId ? "SELECTED" : "OPEN",
        createdBy: "admin",
      })
      .returning();

    // Notify all active drivers about the new request
    const activeDrivers = await db
      .select({ id: driversTable.id })
      .from(driversTable)
      .where(eq(driversTable.status, "ACTIVE"));
    for (const driver of activeDrivers) {
      void notify({
        userId: driver.id,
        userRole: "driver",
        title: "طلب توصيل جديد",
        message: `طلب جديد من ${created.homeLocation} إلى ${created.workLocation}`,
        type: "request",
        relatedId: created.id,
        url: `/driver/request/${created.id}`,
      });
    }

    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "admin POST /requests error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

// POST /api/admin/requests/:id/select-offer — admin selects a driver's offer (same flow as client, but without ownership restriction)
router.post("/requests/:id/select-offer", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { offerId } = req.body ?? {};
  if (!offerId || typeof offerId !== "number") {
    res.status(400).json({ error: "بيانات غير صحيحة: offerId مطلوب" });
    return;
  }

  try {
    const { existingRequest, updated } = await withDbTransaction(async (tx, meta) => {
      const existingRequest = await tx.query.requestsTable.findFirst({
        where: eq(requestsTable.id, id),
      });
      if (!existingRequest) {
        throw Object.assign(new Error("الطلب غير موجود"), { status: 404 });
      }
      if (existingRequest.status !== "OPEN") {
        throw Object.assign(new Error("لا يمكن تأكيد سائق بعد اختيار سائق آخر"), { status: 400 });
      }

      const [offer] = await tx
        .select()
        .from(offersTable)
        .where(and(eq(offersTable.id, offerId), eq(offersTable.requestId, id)));
      if (!offer) {
        throw Object.assign(new Error("العرض غير موجود لهذا الطلب"), { status: 404 });
      }

      const driver = await tx.query.driversTable.findFirst({
        where: eq(driversTable.id, offer.driverId),
      });
      if (!driver) {
        throw Object.assign(new Error("السائق غير موجود"), { status: 404 });
      }

      const bidFee = await getBidFee();

      const [deductedDriver] = await tx
        .update(driversTable)
        .set({ balance: sql`${driversTable.balance} - ${bidFee}::numeric` })
        .where(and(eq(driversTable.id, driver.id), sql`${driversTable.balance} >= ${bidFee}::numeric`))
        .returning();
      if (!deductedDriver) {
        throw Object.assign(new Error("رصيد السائق غير كافٍ للقبول على هذا الطلب"), { status: 400 });
      }

      const [updated] = await tx
        .update(requestsTable)
        .set({ status: "SELECTED", selectedDriverId: driver.id, updatedAt: new Date() })
        .where(and(eq(requestsTable.id, id), eq(requestsTable.status, "OPEN")))
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

      return { existingRequest, updated, driver };
    });

    // Notify the selected driver (outside transaction — non-critical side-effect)
    void notify({
      userId: updated.selectedDriverId!,
      userRole: "driver",
      title: "🎉 تم اختيارك من قِبل الإدارة!",
      message: `اختارت الإدارة عرضك على الطلب من ${existingRequest.homeLocation} إلى ${existingRequest.workLocation}`,
      type: "request",
      relatedId: existingRequest.id,
      url: `/driver/request/${existingRequest.id}`,
    });

    res.json({
      id: updated.id,
      clientId: updated.clientId,
      clientType: updated.clientType,
      homeLocation: updated.homeLocation,
      workLocation: updated.workLocation,
      phone: updated.phone,
      numberOfPeople: updated.numberOfPeople,
      workingDaysPerWeek: updated.workingDaysPerWeek,
      numberOfShifts: updated.numberOfShifts,
      morningTime: updated.morningTime,
      eveningTime: updated.eveningTime,
      notes: updated.notes,
      monthlyPrice: updated.monthlyPrice,
      status: updated.status,
      selectedDriverId: updated.selectedDriverId,
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 403 || status === 404 || status === 409) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    logger.error({ err }, "admin POST /requests/:id/select-offer error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// GET /api/admin/recent-events — last 20 notable events for the admin dashboard
router.get("/recent-events", async (_req, res) => {
  try {
    type RecentEvent = {
      type: "wallet" | "support" | "request" | "offer";
      id: number;
      description: string;
      userName: string | null;
      url: string;
      createdAt: string;
    };

    const events: RecentEvent[] = [];

    // 1. Pending wallet top-up requests
    const walletRows = await db
      .select({
        id: walletTransactionsTable.id,
        driverId: walletTransactionsTable.driverId,
        amount: walletTransactionsTable.amount,
        createdAt: walletTransactionsTable.createdAt,
        driverName: driversTable.name,
      })
      .from(walletTransactionsTable)
      .leftJoin(driversTable, eq(walletTransactionsTable.driverId, driversTable.id))
      .where(eq(walletTransactionsTable.status, "pending"))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(20);
    for (const row of walletRows) {
      events.push({
        type: "wallet",
        id: row.id,
        description: `طلب شحن محفظة — ${parseFloat(String(row.amount)).toFixed(0)} ريال`,
        userName: row.driverName ?? `سائق #${row.driverId}`,
        url: "/admin/settings",
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    // 2. New open support tickets
    const ticketRows = await db
      .select({
        id: supportTicketsTable.id,
        type: supportTicketsTable.type,
        clientId: supportTicketsTable.clientId,
        driverId: supportTicketsTable.driverId,
        createdAt: supportTicketsTable.createdAt,
        clientName: clientsTable.name,
      })
      .from(supportTicketsTable)
      .leftJoin(clientsTable, eq(supportTicketsTable.clientId, clientsTable.id))
      .where(eq(supportTicketsTable.status, "OPEN"))
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(20);

    // Batch-fetch driver names for tickets without a client
    const ticketDriverIds = [...new Set(ticketRows.filter((t) => !t.clientName && t.driverId != null).map((t) => t.driverId!))];
    const ticketDriversMap = new Map<number, string>();
    if (ticketDriverIds.length > 0) {
      const driverRows = await db
        .select({ id: driversTable.id, name: driversTable.name })
        .from(driversTable)
        .where(inArray(driversTable.id, ticketDriverIds));
      for (const d of driverRows) ticketDriversMap.set(d.id, d.name);
    }

    for (const row of ticketRows) {
      const userName = row.clientName ?? (row.driverId ? (ticketDriversMap.get(row.driverId) ?? `سائق #${row.driverId}`) : "مستخدم");
      events.push({
        type: "support",
        id: row.id,
        description: `تذكرة دعم جديدة — ${String(row.type)}`,
        userName,
        url: `/admin/support?ticket=${row.id}`,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    // 3. New open client requests
    const requestRows = await db
      .select({
        id: requestsTable.id,
        homeLocation: requestsTable.homeLocation,
        workLocation: requestsTable.workLocation,
        clientId: requestsTable.clientId,
        createdAt: requestsTable.createdAt,
        clientName: clientsTable.name,
      })
      .from(requestsTable)
      .leftJoin(clientsTable, eq(requestsTable.clientId, clientsTable.id))
      .where(eq(requestsTable.status, "OPEN"))
      .orderBy(desc(requestsTable.createdAt))
      .limit(20);
    for (const row of requestRows) {
      events.push({
        type: "request",
        id: row.id,
        description: `طلب جديد: ${row.homeLocation} ← ${row.workLocation}`,
        userName: row.clientName ?? `عميل #${row.clientId}`,
        url: `/admin/requests?request=${row.id}`,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    // 4. New pending driver offers
    const offerRows = await db
      .select({
        id: offersTable.id,
        driverId: offersTable.driverId,
        requestId: offersTable.requestId,
        createdAt: offersTable.createdAt,
        driverName: driversTable.name,
      })
      .from(offersTable)
      .leftJoin(driversTable, eq(offersTable.driverId, driversTable.id))
      .where(eq(offersTable.status, "PENDING"))
      .orderBy(desc(offersTable.createdAt))
      .limit(20);
    for (const row of offerRows) {
      events.push({
        type: "offer",
        id: row.id,
        description: `عرض جديد على الطلب #${row.requestId}`,
        userName: row.driverName ?? `سائق #${row.driverId}`,
        url: `/admin/offers?offer=${row.id}`,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    // Sort all events by createdAt descending and take top 20
    events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(events.slice(0, 20));
  } catch (err) {
    logger.error({ err }, "admin GET /recent-events error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

export default router;
