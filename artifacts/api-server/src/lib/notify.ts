import webpush from "web-push";
import { db } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable, driversTable, adminsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"];
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const PUSH_RETRY_DELAY_MS = 2000;

export async function clearExpiredSubscription(userId: number, userRole: "client" | "driver" | "admin") {
  try {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, userId),
          eq(pushSubscriptionsTable.userRole, userRole)
        )
      );
  } catch (err) {
    logger.warn({ err, userId, userRole }, "notify: failed to clear expired push subscription");
  }
}

async function getPushSubscription(
  userId: number,
  userRole: "client" | "driver" | "admin"
): Promise<string | null> {
  try {
    const row = await db.query.pushSubscriptionsTable.findFirst({
      where: and(
        eq(pushSubscriptionsTable.userId, userId),
        eq(pushSubscriptionsTable.userRole, userRole)
      ),
      columns: { subscriptionData: true },
    });
    if (!row?.subscriptionData) return null;
    return JSON.stringify(row.subscriptionData);
  } catch (err) {
    logger.warn({ err, userId, userRole }, "notify: failed to fetch push subscription");
  }
  return null;
}

type SendResult = "ok" | "expired" | "error";

async function attemptSend(
  subscription: webpush.PushSubscription,
  payload: string
): Promise<SendResult> {
  try {
    await webpush.sendNotification(subscription, payload);
    return "ok";
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number };
    if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
      return "expired";
    }
    return "error";
  }
}

async function sendWebPush(
  userId: number,
  userRole: "client" | "driver" | "admin",
  subscriptionJson: string,
  notificationId: number | undefined,
  title: string,
  body: string,
  url?: string,
  icon?: string,
  badge?: string
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
  } catch {
    logger.warn({ userId, userRole }, "notify: invalid push subscription JSON");
    void clearExpiredSubscription(userId, userRole);
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url ?? "/",
    // icon and badge are intentionally omitted when not explicitly provided.
    // SVG is not supported by the Web Notification API (badge requires PNG;
    // icon is unreliable with SVG on Android Chrome).  When absent, the browser
    // uses the app icon from the installed PWA manifest automatically.
    ...(icon ? { icon } : {}),
    ...(badge ? { badge } : {}),
  });

  let result = await attemptSend(subscription, payload);

  if (result === "expired") {
    logger.info({ userId, userRole }, "notify: removing expired push subscription");
    void clearExpiredSubscription(userId, userRole);
    return;
  }

  if (result === "error") {
    // One retry after a short delay
    await new Promise<void>((resolve) => setTimeout(resolve, PUSH_RETRY_DELAY_MS));
    result = await attemptSend(subscription, payload);

    if (result === "expired") {
      logger.info({ userId, userRole }, "notify: removing expired push subscription (retry)");
      void clearExpiredSubscription(userId, userRole);
      return;
    }

    if (result === "error") {
      logger.warn({ userId, userRole }, "notify: web push delivery failed after retry");
      return;
    }
  }

  // Successfully delivered — update delivered_at
  if (notificationId !== undefined) {
    try {
      await db
        .update(notificationsTable)
        .set({ deliveredAt: new Date() })
        .where(eq(notificationsTable.id, notificationId));
    } catch (err) {
      logger.warn({ err, notificationId }, "notify: failed to update delivered_at");
    }
  }
}

export async function notify(params: {
  userId: number;
  userRole: "client" | "driver" | "admin";
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
  icon?: string;
  badge?: string;
}) {
  let notificationId: number | undefined;
  try {
    const [inserted] = await db
      .insert(notificationsTable)
      .values({
        userId: params.userId,
        userRole: params.userRole,
        title: params.title,
        message: params.message,
        type: params.type,
        relatedId: params.relatedId ?? null,
        url: params.url ?? null,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });
    notificationId = inserted?.id;
    if (notificationId === undefined) {
      logger.warn({ params }, "notify: insert returned no id — delivered_at tracking will be skipped");
    }
  } catch (err) {
    logger.error({ err, params }, "notify: failed to insert notification record");
  }

  void getPushSubscription(params.userId, params.userRole).then((sub) => {
    if (sub) {
      void sendWebPush(
        params.userId,
        params.userRole,
        sub,
        notificationId,
        params.title,
        params.message,
        params.url,
        params.icon,
        params.badge
      );
    }
  });
}

export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
  icon?: string;
  badge?: string;
}) {
  try {
    const admins = await db.select({ id: adminsTable.id }).from(adminsTable);
    await Promise.all(admins.map((admin) => notify({ userId: admin.id, userRole: "admin", ...params })));
  } catch (err) {
    logger.error({ err }, "notifyAllAdmins: failed to fetch admins or send notifications");
  }
}

export async function notifyAllDrivers(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
  icon?: string;
  badge?: string;
}) {
  try {
    const drivers = await db
      .select({ id: driversTable.id })
      .from(driversTable)
      .where(eq(driversTable.status, "ACTIVE"));
    await Promise.all(drivers.map((driver) => notify({ userId: driver.id, userRole: "driver", ...params })));
  } catch (err) {
    logger.error({ err }, "notifyAllDrivers: failed to fetch drivers or send notifications");
  }
}

export { sendWebPush };

