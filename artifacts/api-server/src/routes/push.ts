import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq, isNotNull, count } from "drizzle-orm";
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
 * Saves a push subscription for the currently logged-in user.
 * Reads the user from req.tokenUser (Bearer token) or req.session.user.
 * Body: { subscription: PushSubscriptionJSON }
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  const { subscription } = req.body ?? {};

  if (!subscription || typeof subscription !== "object") {
    res.status(400).json({ error: "subscription مطلوب" });
    return;
  }

  const subscriptionJson = JSON.stringify(subscription);

  try {
    if (user.role === "client") {
      await db
        .update(clientsTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(clientsTable.id, user.id));
    } else if (user.role === "driver") {
      await db
        .update(driversTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(driversTable.id, user.id));
    } else if (user.role === "admin") {
      await db
        .update(adminsTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(adminsTable.id, user.id));
    }

    logger.info({ userId: user.id, role: user.role }, "push: subscription saved");
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
      .from(clientsTable)
      .where(isNotNull(clientsTable.pushSubscription));

    const [driverCount] = await db
      .select({ count: count() })
      .from(driversTable)
      .where(isNotNull(driversTable.pushSubscription));

    const [adminCount] = await db
      .select({ count: count() })
      .from(adminsTable)
      .where(isNotNull(adminsTable.pushSubscription));

    // Collect the last 10 registered endpoints per role (endpoint only, no keys)
    const clientRows = await db
      .select({ pushSubscription: clientsTable.pushSubscription, id: clientsTable.id })
      .from(clientsTable)
      .where(isNotNull(clientsTable.pushSubscription))
      .limit(10);

    const driverRows = await db
      .select({ pushSubscription: driversTable.pushSubscription, id: driversTable.id })
      .from(driversTable)
      .where(isNotNull(driversTable.pushSubscription))
      .limit(10);

    const adminRows = await db
      .select({ pushSubscription: adminsTable.pushSubscription, id: adminsTable.id })
      .from(adminsTable)
      .where(isNotNull(adminsTable.pushSubscription))
      .limit(10);

    function extractEndpoint(json: string | null): string | null {
      if (!json) return null;
      try {
        const parsed = JSON.parse(json) as { endpoint?: string };
        return parsed.endpoint ?? null;
      } catch {
        return null;
      }
    }

    const devices = [
      ...clientRows.map((r) => ({ role: "client", userId: r.id, endpoint: extractEndpoint(r.pushSubscription) })),
      ...driverRows.map((r) => ({ role: "driver", userId: r.id, endpoint: extractEndpoint(r.pushSubscription) })),
      ...adminRows.map((r) => ({ role: "admin", userId: r.id, endpoint: extractEndpoint(r.pushSubscription) })),
    ];

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
    if (user.role === "client") {
      await db
        .update(clientsTable)
        .set({ pushSubscription: null })
        .where(eq(clientsTable.id, user.id));
    } else if (user.role === "driver") {
      await db
        .update(driversTable)
        .set({ pushSubscription: null })
        .where(eq(driversTable.id, user.id));
    } else if (user.role === "admin") {
      await db
        .update(adminsTable)
        .set({ pushSubscription: null })
        .where(eq(adminsTable.id, user.id));
    }

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
        url: url as string | undefined,
      });
    } else if (target === "all_drivers") {
      void notifyAllDrivers({ title, message, type: "system", url: url as string | undefined });
    } else {
      void notifyAllAdmins({ title, message, type: "system", url: url as string | undefined });
    }

    res.json({ message: "تم إرسال الإشعار" });
  } catch (err) {
    logger.error({ err }, "push/send: failed to dispatch notification");
    res.status(500).json({ error: "فشل إرسال الإشعار" });
  }
});

export default router;
