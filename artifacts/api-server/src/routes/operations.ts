import { Router } from "express";
import { db } from "@workspace/db";
import {
  requestsTable,
  driversTable,
  clientsTable,
  notificationsTable,
  pushSubscriptionsTable,
  appConfigTable,
} from "@workspace/db";
import { systemErrorsTable, systemAlertsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";
import { eq, and, gte, lte, desc, count, sql, ne } from "drizzle-orm";

const router = Router();
router.use(requireAuth("admin"));

const SERVER_ERROR = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// GET /api/admin/operations-stats
router.get("/operations-stats", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [todayResult] = await db.select({ count: count() }).from(requestsTable)
      .where(gte(requestsTable.createdAt, todayStart));
    const [activeResult] = await db.select({ count: count() }).from(requestsTable)
      .where(eq(requestsTable.status, "ACTIVE"));
    const [delayedResult] = await db.select({ count: count() }).from(requestsTable)
      .where(and(eq(requestsTable.status, "OPEN"), lte(requestsTable.createdAt, twoDaysAgo)));
    const [driverCountResult] = await db.select({ count: count() }).from(driversTable)
      .where(ne(driversTable.status, "DELETED"));
    const [activeDriversResult] = await db.select({ count: count() }).from(driversTable)
      .where(eq(driversTable.status, "ACTIVE"));
    const [clientCountResult] = await db.select({ count: count() }).from(clientsTable);
    const [errorsResult] = await db.select({ count: count() }).from(systemErrorsTable)
      .where(eq(systemErrorsTable.resolved, false));
    const [notifResult] = await db.select({ count: count() }).from(notificationsTable);

    res.json({
      todayRequests: Number(todayResult?.count ?? 0),
      activeRequests: Number(activeResult?.count ?? 0),
      delayedRequests: Number(delayedResult?.count ?? 0),
      connectedDrivers: Number(activeDriversResult?.count ?? 0),
      totalDrivers: Number(driverCountResult?.count ?? 0),
      totalClients: Number(clientCountResult?.count ?? 0),
      currentErrors: Number(errorsResult?.count ?? 0),
      totalNotifications: Number(notifResult?.count ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "operations-stats error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// GET /api/admin/system-health
router.get("/system-health", async (_req, res) => {
  const now = new Date().toISOString();
  const services = [];

  let dbStatus = "healthy";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  services.push({ name: "API", nameAr: "الخادم", status: "healthy", lastCheck: now });
  services.push({ name: "Database", nameAr: "قاعدة البيانات", status: dbStatus, lastCheck: now });
  services.push({ name: "Auth", nameAr: "نظام التوثيق", status: "healthy", lastCheck: now });

  const vapidPublic = process.env["VAPID_PUBLIC_KEY"] ?? process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
  services.push({
    name: "Push Notifications",
    nameAr: "الإشعارات",
    status: vapidPublic ? "healthy" : "warning",
    lastCheck: now,
  });

  const overall = services.some(s => s.status === "error") ? "error"
    : services.some(s => s.status === "warning") ? "warning"
    : "healthy";

  res.json({ services, overall, timestamp: now });
});

// GET /api/admin/live-errors
router.get("/live-errors", async (req, res) => {
  try {
    const severity = req.query["severity"] as string | undefined;
    const limit = Math.min(parseInt((req.query["limit"] as string) ?? "50", 10), 200);

    const errors = severity
      ? await db.select().from(systemErrorsTable)
          .where(eq(systemErrorsTable.severity, severity))
          .orderBy(desc(systemErrorsTable.createdAt))
          .limit(limit)
      : await db.select().from(systemErrorsTable)
          .orderBy(desc(systemErrorsTable.createdAt))
          .limit(limit);

    res.json(errors);
  } catch (err) {
    logger.error({ err }, "live-errors GET error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// POST /api/admin/live-errors
router.post("/live-errors", async (req, res) => {
  try {
    const { errorType, message, stack, page, userId, userRole, severity = "error" } = req.body ?? {};
    if (!errorType || !message) {
      res.status(400).json({ error: "errorType and message are required" });
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await db.select().from(systemErrorsTable)
      .where(and(
        eq(systemErrorsTable.errorType, errorType),
        eq(systemErrorsTable.message, message),
        gte(systemErrorsTable.createdAt, oneHourAgo),
        eq(systemErrorsTable.resolved, false),
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db.update(systemErrorsTable)
        .set({ count: (existing[0]!.count ?? 1) + 1, updatedAt: new Date() })
        .where(eq(systemErrorsTable.id, existing[0]!.id))
        .returning();
      res.json(updated[0]);
    } else {
      const inserted = await db.insert(systemErrorsTable)
        .values({ errorType, message, stack, page, userId, userRole, severity })
        .returning();
      res.json(inserted[0]);
    }
  } catch (err) {
    logger.error({ err }, "live-errors POST error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// PATCH /api/admin/live-errors/:id/resolve
router.patch("/live-errors/:id/resolve", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرف غير صالح" }); return; }
    const updated = await db.update(systemErrorsTable)
      .set({ resolved: true, updatedAt: new Date() })
      .where(eq(systemErrorsTable.id, id))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    logger.error({ err }, "live-errors resolve error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// GET /api/admin/operations-alerts
router.get("/operations-alerts", async (_req, res) => {
  try {
    const alerts = await db.select().from(systemAlertsTable)
      .where(eq(systemAlertsTable.isRead, false))
      .orderBy(desc(systemAlertsTable.createdAt))
      .limit(20);
    res.json(alerts);
  } catch (err) {
    logger.error({ err }, "operations-alerts GET error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// PATCH /api/admin/operations-alerts/:id/read
router.patch("/operations-alerts/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    if (isNaN(id)) { res.status(400).json({ error: "معرف غير صالح" }); return; }
    const updated = await db.update(systemAlertsTable)
      .set({ isRead: true })
      .where(eq(systemAlertsTable.id, id))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    logger.error({ err }, "operations-alerts read error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// GET /api/admin/database-monitor
router.get("/database-monitor", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        relname AS table_name,
        n_live_tup AS row_count,
        pg_total_relation_size(quote_ident(relname)) / 1024 AS size_kb
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);
    const tables = (result.rows as Array<{ table_name: string; row_count: string; size_kb: string }>).map(r => ({
      name: r.table_name,
      rowCount: parseInt(r.row_count, 10) || 0,
      sizeKb: parseInt(r.size_kb, 10) || 0,
    }));
    const totalSizeKb = tables.reduce((sum, t) => sum + t.sizeKb, 0);
    res.json({ tables, totalSizeKb });
  } catch (err) {
    logger.error({ err }, "database-monitor error");
    res.json({ tables: [], totalSizeKb: 0, error: "تعذّر قراءة إحصائيات قاعدة البيانات" });
  }
});

// GET /api/admin/notifications-monitor
router.get("/notifications-monitor", async (_req, res) => {
  try {
    const [notifCountResult] = await db.select({ count: count() }).from(notificationsTable);
    const [subsCountResult] = await db.select({ count: count() }).from(pushSubscriptionsTable);

    const recentNotifs = await db.select().from(notificationsTable)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10);

    const vapidPublic = process.env["VAPID_PUBLIC_KEY"] ?? process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
    const vapidPrivate = process.env["VAPID_PRIVATE_KEY"];

    res.json({
      totalNotifications: Number(notifCountResult?.count ?? 0),
      totalSubscriptions: Number(subsCountResult?.count ?? 0),
      recentNotifications: recentNotifs,
      pushStatus: (vapidPublic && vapidPrivate) ? "configured" : "not_configured",
    });
  } catch (err) {
    logger.error({ err }, "notifications-monitor error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// GET /api/admin/maintenance-mode
router.get("/maintenance-mode", async (_req, res) => {
  try {
    const row = await db.query.appConfigTable.findFirst({
      where: eq(appConfigTable.key, "maintenance_mode"),
    });
    res.json({ enabled: row?.value === "true" });
  } catch (err) {
    logger.error({ err }, "maintenance-mode GET error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

// POST /api/admin/maintenance-mode
router.post("/maintenance-mode", async (req, res) => {
  try {
    const { enabled } = req.body ?? {};
    const value = enabled ? "true" : "false";
    const existing = await db.query.appConfigTable.findFirst({
      where: eq(appConfigTable.key, "maintenance_mode"),
    });
    if (existing) {
      await db.update(appConfigTable).set({ value }).where(eq(appConfigTable.key, "maintenance_mode"));
    } else {
      await db.insert(appConfigTable).values({ key: "maintenance_mode", value });
    }
    res.json({ enabled: enabled === true });
  } catch (err) {
    logger.error({ err }, "maintenance-mode POST error");
    res.status(500).json({ error: SERVER_ERROR });
  }
});

export default router;
