import webpush from "web-push";
import { db } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable, driversTable, adminsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

function getVapidConfig(): { public: string; private: string; subject: string } | null {
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  if (!pub || !priv) return null;
  const subject = process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app";
  return { public: pub, private: priv, subject };
}

/**
 * Normalizes a stored push subscription object to the flat format expected by
 * the web-push library: { endpoint, expirationTime?, keys: { p256dh, auth } }.
 *
 * Some subscriptions may have been stored in the wrapped format
 * { subscription: { endpoint, keys, … }, role } if the canonical
 * normalization failed at subscribe time.  This function unwraps those so
 * that web-push always receives a valid PushSubscription object.
 */
function normalizeSubscriptionData(data: Record<string, unknown>): Record<string, unknown> {
  // Already in correct format — has endpoint at top level
  if (typeof data["endpoint"] === "string" && data["endpoint"]) {
    return data;
  }
  // Wrapped format: { subscription: { endpoint, keys, … }, … }
  const nested = data["subscription"];
  if (
    nested != null &&
    typeof nested === "object" &&
    typeof (nested as Record<string, unknown>)["endpoint"] === "string"
  ) {
    return nested as Record<string, unknown>;
  }
  return data;
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
    // Normalize to flat format so sendWebPush always receives { endpoint, keys }
    const normalized = normalizeSubscriptionData(row.subscriptionData as Record<string, unknown>);
    return JSON.stringify(normalized);
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
  actionType?: "open_url" | "emit_event",
  actionPayload?: Record<string, unknown> | null,
  icon?: string,
  badge?: string
): Promise<void> {
  const vapid = getVapidConfig();
  if (!vapid) {
    logger.warn({ userId, userRole, notificationId }, "notify: skipping web push because VAPID is not configured");
    return;
  }

  // Configure VAPID details at send time to pick up any runtime env changes
  webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);

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
    notificationId,
    url: url ?? "/",
    actionType: actionType ?? "open_url",
    actionPayload: actionPayload ?? null,
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

  logger.info({ userId, userRole, notificationId }, "notify: web push delivered");

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
  actionType?: "open_url" | "emit_event";
  actionLabel?: string;
  actionPayload?: Record<string, unknown> | null;
  icon?: string;
  badge?: string;
}) {
  let notificationId: number | undefined;
  logger.info(
    {
      userId: params.userId,
      userRole: params.userRole,
      type: params.type,
      url: params.url ?? null,
      actionType: params.actionType ?? null,
    },
    "notify: creating notification"
  );
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
        actionType: params.actionType ?? "open_url",
        actionLabel: params.actionLabel ?? null,
        actionPayload: params.actionPayload ?? null,
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
      logger.info({ userId: params.userId, userRole: params.userRole, notificationId }, "notify: push subscription found");
      void sendWebPush(
        params.userId,
        params.userRole,
        sub,
        notificationId,
          params.title,
          params.message,
          params.url,
          params.actionType,
          params.actionPayload ?? null,
          params.icon,
          params.badge
        );
      return;
    }
    logger.info({ userId: params.userId, userRole: params.userRole, notificationId }, "notify: no push subscription stored for recipient");
  });
}

export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
  actionType?: "open_url" | "emit_event";
  actionLabel?: string;
  actionPayload?: Record<string, unknown> | null;
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
  actionType?: "open_url" | "emit_event";
  actionLabel?: string;
  actionPayload?: Record<string, unknown> | null;
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
