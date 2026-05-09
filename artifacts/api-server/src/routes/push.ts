import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, isNotNull, count, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { notify, sendPushToUser, notifyAllDrivers, notifyAllAdmins } from "../lib/notify";
import {
  getNotificationTargetingMetadata,
  resolveNotificationRecipients,
  type NotificationAudience,
} from "../lib/notification-targeting";
import { z } from "zod";

const router = Router();

const roleSchema = z.enum(["client", "driver", "admin"]);

const audienceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("roles"), roles: z.array(roleSchema).min(1) }),
  z.object({ mode: z.literal("user"), userId: z.number().int().positive(), userRole: roleSchema }),
  z.object({
    mode: z.literal("filters"),
    segments: z.array(
      z.object({
        role: roleSchema,
        filters: z.array(
          z.object({
            field: z.string(),
            operator: z.string(),
            value: z.unknown().optional(),
          })
        ),
      })
    ),
  }),
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
 * OneSignal يدير الـ subscriptions — نرجع دائماً true
 */
router.get("/status", requireAuth(), async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ hasSubscription: true, provider: "onesignal" });
});

/**
 * GET /api/push/vapid-public-key
 * محتفظ به للتوافق مع الكود القديم
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
 * محتفظ به للتوافق — OneSignal يدير الـ subscriptions تلقائياً
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  logger.info({ userId: user.id, userRole: user.role }, "push/subscribe: OneSignal manages subscriptions automatically");
  res.json({ ok: true, message: "OneSignal manages subscriptions" });
});

/**
 * GET /api/push/targeting-metadata
 * بيانات الاستهداف للإشعارات (الأدوار، الحقول، المستخدمون)
 * يستخدمه AdminNotificationComposer
 */
router.get("/targeting-metadata", requireAuth("admin"), async (_req, res) => {
  try {
    const metadata = await getNotificationTargetingMetadata();
    res.json(metadata);
  } catch (err) {
    logger.error({ err }, "push/targeting-metadata: failed");
    res.status(500).json({ error: "فشل جلب بيانات الاستهداف" });
  }
});

/**
 * GET /api/push/analytics
 * إحصائيات تحليلية للإشعارات (لوحة التحكم)
 */
router.get("/analytics", requireAuth("admin"), async (_req, res) => {
  try {
    const [totalResult] = await db.select({ count: count() }).from(notificationsTable);
    const [deliveredResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.deliveredAt));
    const [failedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNull(notificationsTable.deliveredAt));
    const [clickedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.clickedAt));

    const total = Number(totalResult?.count ?? 0);
    const delivered = Number(deliveredResult?.count ?? 0);
    const failed = Number(failedResult?.count ?? 0);
    const clicked = Number(clickedResult?.count ?? 0);

    res.json({
      total,
      delivered,
      failed,
      clicked,
      deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) + "%" : "0%",
      clickRate: delivered > 0 ? ((clicked / delivered) * 100).toFixed(1) + "%" : "0%",
    });
  } catch (err) {
    logger.error({ err }, "push/analytics: failed");
    res.status(500).json({ error: "فشل جلب الإحصائيات" });
  }
});

/**
 * POST /api/push/send
 * إرسال إشعار عبر OneSignal مع دعم الاستهداف المتقدم
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
      res.json({ ok: true, recipientCount: 1, recipientsByRole: { [audience.userRole]: 1 }, sampleRecipients: [] });
    } else if (audience.mode === "filters") {
      // استهداف متقدم بالفلاتر
      const recipients = await resolveNotificationRecipients(audience as NotificationAudience);
      let sent = 0;
      for (const recipient of recipients) {
        try {
          await notify({
            userId: recipient.id,
            userRole: recipient.role,
            title,
            message,
            type,
            url,
          });
          sent++;
        } catch {
          // لا نوقف الإرسال بسبب خطأ واحد
        }
      }
      const byRole = recipients.reduce<Record<string, number>>((acc, r) => {
        acc[r.role] = (acc[r.role] ?? 0) + 1;
        return acc;
      }, {});
      res.json({
        ok: true,
        recipientCount: sent,
        recipientsByRole: byRole,
        sampleRecipients: recipients.slice(0, 5),
      });
    } else if (audience.mode === "roles") {
      let sent = 0;
      const byRole: Record<string, number> = {};
      for (const role of audience.roles) {
        if (role === "driver") {
          await notifyAllDrivers({ title, message, type, url });
          byRole.driver = 1;
          sent++;
        } else if (role === "admin") {
          await notifyAllAdmins({ title, message, type, url });
          byRole.admin = 1;
          sent++;
        } else if (role === "client") {
          logger.warn({ role }, "push/send: broadcast to clients not yet implemented");
        }
      }
      res.json({ ok: true, recipientCount: sent, recipientsByRole: byRole, sampleRecipients: [] });
    } else {
      // mode === "all"
      await notifyAllDrivers({ title, message, type, url });
      await notifyAllAdmins({ title, message, type, url });
      res.json({ ok: true, recipientCount: -1, recipientsByRole: {}, sampleRecipients: [], message: "Broadcast sent to all" });
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
 * إحصائيات مبسّطة
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
