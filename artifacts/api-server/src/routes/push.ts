import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, isNotNull, count, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { notify, sendPushToUser, notifyAllDrivers, notifyAllAdmins } from "../lib/notify";
import { z } from "zod";

const router = Router();

const roleSchema = z.enum(["client", "driver", "admin"]);

const audienceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("roles"), roles: z.array(roleSchema).min(1) }),
  z.object({ mode: z.literal("user"), userId: z.number().int().positive(), userRole: roleSchema }),
]);

const sendRequestSchema = z.object({
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  type: z.enum(["offer", "request", "system", "support"]).default("system"),
  url: z.string().trim().min(1).optional(),
  audience: audienceSchema,
});

/**
 * GET /api/push/status
 * OneSignal يدير الـ subscriptions — نرجع دائماً true لأن OneSignal يتولى الأمر
 */
router.get("/status", requireAuth(), async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // OneSignal يدير الـ subscriptions من طرفه
  res.json({ hasSubscription: true, provider: "onesignal" });
});

/**
 * GET /api/push/vapid-public-key
 * محتفظ به للتوافق مع الكود القديم — لم يعد مستخدماً مع OneSignal
 */
router.get("/vapid-public-key", (_req, res) => {
  const key = process.env["VAPID_PUBLIC_KEY"];
  if (!key) {
    res.status(503).json({ error: "VAPID not configured — using OneSignal" });
    return;
  }
  res.json({ publicKey: key });
});

/**
 * POST /api/push/subscribe
 * محتفظ به للتوافق — OneSignal يدير الـ subscriptions تلقائياً من الفرونت
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  logger.info({ userId: user.id, userRole: user.role }, "push/subscribe: OneSignal manages subscriptions automatically");
  res.json({ ok: true, message: "OneSignal manages subscriptions" });
});

/**
 * POST /api/push/send
 * إرسال إشعار عبر OneSignal
 */
router.post("/send", requireAuth("admin"), async (req, res) => {
  const parsed = sendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }

  const { title, message, type, url, audience } = parsed.data;

  try {
    if (audience.mode === "user") {
      await notify({
        userId: audience.userId,
        userRole: audience.userRole,
        title,
        message,
        type,
        url,
      });
      res.json({ ok: true, sent: 1 });
    } else if (audience.mode === "roles") {
      // إرسال جماعي لدور محدد عبر OneSignal filters
      let sent = 0;
      for (const role of audience.roles) {
        if (role === "driver") {
          await notifyAllDrivers({ title, message, type, url });
          sent++;
        } else if (role === "admin") {
          await notifyAllAdmins({ title, message, type, url });
          sent++;
        } else if (role === "client") {
          // TODO: notifyAllClients — إضافة مستقبلاً
          logger.warn({ role }, "push/send: broadcast to clients not yet implemented");
        }
      }
      res.json({ ok: true, sent });
    } else {
      // mode === "all": إرسال لكل الأدوار
      await notifyAllDrivers({ title, message, type, url });
      await notifyAllAdmins({ title, message, type, url });
      res.json({ ok: true, message: "Broadcast sent to all roles" });
    }
  } catch (err) {
    logger.error({ err }, "push/send: failed");
    res.status(500).json({ error: "فشل الإرسال" });
  }
});

/**
 * POST /api/push/test
 * اختبار إرسال إشعار للمستخدم الحالي
 */
router.post("/test", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;

  try {
    const result = await sendPushToUser(user.id, user.role as "client" | "driver" | "admin", {
      title: "🔔 اختبار الإشعارات",
      body: "إذا وصلك هذا الإشعار، فالنظام يعمل بشكل صحيح ✓",
      url: "/",
    });

    res.json({ ok: result.sent, sent: result.sent });
  } catch (err) {
    logger.error({ err, userId: user.id }, "push/test: failed");
    res.status(500).json({ error: "فشل اختبار الإشعار" });
  }
});

/**
 * GET /api/push/stats
 * إحصائيات الإشعارات من DB
 */
router.get("/stats", requireAuth("admin"), async (_req, res) => {
  try {
    const [totalResult] = await db.select({ count: count() }).from(notificationsTable);
    const [deliveredResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.deliveredAt));
    const [pendingResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNull(notificationsTable.deliveredAt));

    res.json({
      total: totalResult?.count ?? 0,
      delivered: deliveredResult?.count ?? 0,
      pending: pendingResult?.count ?? 0,
      provider: "onesignal",
    });
  } catch (err) {
    logger.error({ err }, "push/stats: failed");
    res.status(500).json({ error: "فشل جلب الإحصائيات" });
  }
});

/**
 * GET /api/push/notifications
 * آخر الإشعارات للمستخدم الحالي
 */
router.get("/notifications", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  try {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, user.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifications);
  } catch (err) {
    logger.error({ err }, "push/notifications: failed");
    res.status(500).json({ error: "فشل جلب الإشعارات" });
  }
});

export default router;
