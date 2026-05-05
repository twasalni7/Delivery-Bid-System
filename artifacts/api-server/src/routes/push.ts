import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, isNotNull, count, isNull, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { notify, notifyAllDrivers, notifyAllAdmins } from "../lib/notify";

const router = Router();

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for the frontend to use with pushManager.subscribe.
 */
router.get("/vapid-public-key", (_req, res) => {
  const key = process.env["VAPID_PUBLIC_KEY"];
  if (!key) {
    res.status(503).json({ error: "Push notifications are not configured on this server" });
    return;
  }
  res.json({ publicKey: key });
});

/**
 * POST /api/push/subscribe
 * Saves (or updates) a push subscription for the currently logged-in user.
 * Reads the user from req.tokenUser (Bearer token) or req.session.user.
 * Body: { subscription: PushSubscriptionJSON }
 *
 * Uses INSERT … ON CONFLICT DO UPDATE so that re-subscribing the same device
 * only updates the existing row (no duplicates).
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  const { subscription } = req.body ?? {};

  if (!subscription || typeof subscription !== "object") {
    res.status(400).json({ error: "subscription مطلوب" });
    return;
  }

  // Validate that the subscription contains the required fields
  const sub = subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    logger.warn({ userId: user.id, role: user.role }, "push: subscribe request missing required fields (endpoint/keys)");
    res.status(400).json({ error: "subscription يجب أن يحتوي على endpoint وkeys.p256dh وkeys.auth" });
    return;
  }

  logger.info({ userId: user.id, role: user.role }, "push: saving subscription");

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId: user.id,
        userRole: user.role,
        subscriptionData: subscription as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptionsTable.userId, pushSubscriptionsTable.userRole],
        set: { subscriptionData: sql`excluded.subscription_data` },
      });

    logger.info({ userId: user.id, role: user.role }, "push: subscription saved to push_subscriptions");
    res.json({ message: "تم حفظ الاشتراك في الإشعارات" });
  } catch (err) {
    logger.error({ err, userId: user.id, role: user.role }, "push: failed to save subscription");
    res.status(500).json({ error: "فشل حفظ الاشتراك" });
  }
});

/**
 * GET /api/push/debug
 * Admin-only endpoint that returns push notification system diagnostics:
 * subscription counts per role, VAPID configuration status, and
 * a summary of endpoints currently registered.
 */
router.get("/debug", requireAuth("admin"), async (_req, res) => {
  const vapidConfigured = Boolean(
    process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]
  );

  try {
    const [clientCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "client"));

    const [driverCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "driver"));

    const [adminCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "admin"));

    // Collect the last 10 registered endpoints per role (endpoint only, no keys)
    const rows = await db
      .select({
        userId: pushSubscriptionsTable.userId,
        userRole: pushSubscriptionsTable.userRole,
        subscriptionData: pushSubscriptionsTable.subscriptionData,
      })
      .from(pushSubscriptionsTable)
      .limit(30);

    function extractEndpoint(data: unknown): string | null {
      if (!data || typeof data !== "object") return null;
      const obj = data as { endpoint?: string };
      return obj.endpoint ?? null;
    }

    const devices = rows.map((r) => ({
      role: r.userRole,
      userId: r.userId,
      endpoint: extractEndpoint(r.subscriptionData),
    }));

    res.json({
      vapidConfigured,
      vapidPublicKey: process.env["VAPID_PUBLIC_KEY"] ?? null,
      subscriptions: {
        clients: Number(clientCount?.count ?? 0),
        drivers: Number(driverCount?.count ?? 0),
        admins: Number(adminCount?.count ?? 0),
        total:
          Number(clientCount?.count ?? 0) +
          Number(driverCount?.count ?? 0) +
          Number(adminCount?.count ?? 0),
      },
      devices,
    });
  } catch (err) {
    logger.error({ err }, "push/debug: failed to fetch stats");
    res.status(500).json({ error: "فشل جلب إحصائيات الإشعارات" });
  }
});

/**
 * POST /api/push/unsubscribe
 * Removes the push subscription for the currently logged-in user.
 */
router.post("/unsubscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;

  try {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, user.id),
          eq(pushSubscriptionsTable.userRole, user.role)
        )
      );

    logger.info({ userId: user.id, role: user.role }, "push: subscription removed");
    res.json({ message: "تم إلغاء الاشتراك في الإشعارات" });
  } catch (err) {
    logger.error({ err, userId: user.id, role: user.role }, "push: failed to remove subscription");
    res.status(500).json({ error: "فشل إلغاء الاشتراك" });
  }
});

/**
 * POST /api/push/send
 * Admin-only: sends a push notification to a specific user, all drivers, or all admins.
 * Body: {
 *   target: "user" | "all_drivers" | "all_admins",
 *   userId?: number,
 *   userRole?: "client" | "driver" | "admin",
 *   title: string,
 *   message: string,
 *   url?: string,
 * }
 */
router.post("/send", requireAuth("admin"), async (req, res) => {
  const { target, userId, userRole, title, message, url } = req.body ?? {};

  if (!title || typeof title !== "string" || !message || typeof message !== "string") {
    res.status(400).json({ error: "title و message مطلوبان" });
    return;
  }

  if (!["user", "all_drivers", "all_admins"].includes(target)) {
    res.status(400).json({ error: "target يجب أن يكون: user | all_drivers | all_admins" });
    return;
  }

  try {
    if (target === "user") {
      if (!userId || !["client", "driver", "admin"].includes(userRole)) {
        res.status(400).json({ error: "userId و userRole مطلوبان عند target=user" });
        return;
      }
      void notify({
        userId: Number(userId),
        userRole: userRole as "client" | "driver" | "admin",
        title,
        message,
        type: "system",
        url,
      });
    } else if (target === "all_drivers") {
      void notifyAllDrivers({ title, message, type: "system", url });
    } else {
      void notifyAllAdmins({ title, message, type: "system", url });
    }

    res.json({ message: "تم إرسال الإشعار" });
  } catch (err) {
    logger.error({ err }, "push/send: failed to dispatch notification");
    res.status(500).json({ error: "فشل إرسال الإشعار" });
  }
});

/**
 * GET /api/push/analytics
 * Admin-only: returns notification delivery and engagement statistics.
 */
router.get("/analytics", requireAuth("admin"), async (_req, res) => {
  try {
    const [totalResult] = await db
      .select({ count: count() })
      .from(notificationsTable);

    const [deliveredResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.deliveredAt));

    const [clickedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.clickedAt));

    const [failedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNull(notificationsTable.deliveredAt));

    const total     = Number(totalResult?.count ?? 0);
    const delivered = Number(deliveredResult?.count ?? 0);
    const clicked   = Number(clickedResult?.count ?? 0);
    const failed    = Number(failedResult?.count ?? 0);

    res.json({
      total,
      delivered,
      failed,
      clicked,
      deliveryRate: total > 0 ? `${((delivered / total) * 100).toFixed(1)}%` : "0%",
      clickRate:    delivered > 0 ? `${((clicked / delivered) * 100).toFixed(1)}%` : "0%",
    });
  } catch (err) {
    logger.error({ err }, "push/analytics: failed to fetch stats");
    res.status(500).json({ error: "فشل جلب إحصائيات الإشعارات" });
  }
});

export default router;
