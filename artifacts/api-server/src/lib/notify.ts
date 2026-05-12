import webpush from "web-push";
import { db, pool } from "@workspace/db";
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

// Initialize VAPID at module load
(function initVapid() {
  const vapid = getVapidConfig();
  if (vapid) {
    webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);
    logger.info("[push] VAPID details initialized at module load");
  } else {
    logger.warn("[push] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing — push notifications will be disabled until they are set");
  }
})();

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

function shouldFallbackToLegacyPushSchema(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const dbErr = err as { code?: string; message?: string };
  if (dbErr.code === "42703" || dbErr.code === "42P10") return true;
  const message = dbErr.message?.toLowerCase() ?? "";
  return (
    message.includes('column "user_role" does not exist') ||
    message.includes("no unique or exclusion constraint matching the on conflict specification")
  );
}

async function getLegacyPushSubscription(userId: number): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT subscription_data
         FROM push_subscriptions
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT 1`,
      [userId]
    );
    const raw = result.rows[0]?.["subscription_data"];
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      return JSON.stringify(normalizeSubscriptionData(raw as Record<string, unknown>));
    }
  } catch (err) {
    logger.warn({ err, userId }, "notify: failed to fetch legacy push subscription");
  }
  return null;
}

const PUSH_RETRY_DELAY_MS = 2000;
const DEFAULT_APP_URL = "https://sharq.it.com";

function getAppOrigin(): string {
  const configured =
    process.env["APP_URL"] ??
    process.env["PUBLIC_APP_URL"] ??
    process.env["SITE_URL"] ??
    DEFAULT_APP_URL;
  return configured.replace(/\/+$/, "");
}

function getNotificationLandingPath(userRole: "client" | "driver" | "admin"): string {
  if (userRole === "admin") return "/admin/notifications";
  if (userRole === "driver") return "/driver/notifications";
  return "/client/notifications";
}

function buildPushTrackingUrl(params: {
  userRole: "client" | "driver" | "admin";
  notificationId?: number;
  url?: string;
  actionType?: "open_url" | "emit_event";
  actionPayload?: Record<string, unknown> | null;
}): string {
  const rawTarget = params.url?.trim() || getNotificationLandingPath(params.userRole);
  const safeTarget =
    rawTarget.startsWith("/") ? rawTarget : getNotificationLandingPath(params.userRole);
  const targetUrl = new URL(safeTarget, getAppOrigin());

  if (params.notificationId !== undefined) {
    targetUrl.searchParams.set("notificationId", String(params.notificationId));
    targetUrl.searchParams.set("notificationSource", "push");
    targetUrl.searchParams.set(
      "notificationAction",
      params.actionType === "emit_event" ? "action" : "open"
    );
  }

  const eventName =
    params.actionType === "emit_event" &&
    typeof params.actionPayload?.["eventName"] === "string"
      ? params.actionPayload["eventName"]
      : null;

  if (eventName) {
    targetUrl.searchParams.set("notificationEvent", eventName);
    targetUrl.searchParams.set(
      "notificationPayload",
      JSON.stringify(params.actionPayload ?? null)
    );
  }

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

async function markNotificationDelivered(notificationId: number | undefined) {
  if (notificationId === undefined) return;

  try {
    await db
      .update(notificationsTable)
      .set({ deliveredAt: new Date(), deliveryStatus: "delivered", deliveryError: null })
      .where(eq(notificationsTable.id, notificationId));
  } catch (err) {
    logger.warn({ err, notificationId }, "notify: failed to update delivered_at");
  }
}

async function markNotificationFailed(params: {
  notificationId: number | undefined;
  error: string;
  provider?: string | null;
  response?: Record<string, unknown> | null;
}) {
  if (params.notificationId === undefined) return;
  try {
    await db
      .update(notificationsTable)
      .set({
        deliveryStatus: "failed",
        deliveryError: params.error,
        provider: params.provider ?? null,
        providerResponse: params.response ?? null,
      })
      .where(eq(notificationsTable.id, params.notificationId));
  } catch (err) {
    logger.warn({ err, notificationId: params.notificationId }, "notify: failed to update delivery failure");
  }
}

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
    if (shouldFallbackToLegacyPushSchema(err)) {
      try {
        await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
        return;
      } catch (legacyErr) {
        logger.warn(
          { err: legacyErr, userId, userRole },
          "notify: failed to clear expired legacy push subscription"
        );
        return;
      }
    }
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
    if (shouldFallbackToLegacyPushSchema(err)) {
      logger.warn(
        { err, userId, userRole },
        "notify: modern push schema unavailable, falling back to legacy push subscription lookup"
      );
      return getLegacyPushSubscription(userId);
    }
    logger.warn({ err, userId, userRole }, "notify: failed to fetch push subscription");
  }
  return null;
}

type SendResult = "ok" | "expired" | "error";

async function attemptSend(
  subscription: webpush.PushSubscription,
  payload: string,
  context: { userId: number; userRole: string }
): Promise<SendResult> {
  try {
    await webpush.sendNotification(subscription, payload);
    return "ok";
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number; body?: string };
    const statusCode = pushErr?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return "expired";
    }
    logger.warn(
      { ...context, statusCode: statusCode ?? null, errorBody: pushErr?.body ?? null },
      "notify: web push attempt failed"
    );
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
  const pushDebug = process.env["PUSH_DEBUG"] === "true";
  const vapid = getVapidConfig();
  if (!vapid) {
    logger.warn({ userId, userRole, notificationId }, "notify: skipping web push because VAPID is not configured");
    await markNotificationFailed({
      notificationId,
      error: "vapid_not_configured",
      provider: "web-push",
    });
    return;
  }

  if (pushDebug) {
    logger.info(
      {
        userId,
        userRole,
        notificationId,
        "vapid.public.prefix": vapid.public.substring(0, Math.min(20, vapid.public.length)) + "...",
        "vapid.subject": vapid.subject,
      },
      "notify: sendWebPush called"
    );
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

  const ctx = { userId, userRole };

  logger.info({ userId, userRole, notificationId }, "notify: attempting web push delivery");

  let result = await attemptSend(subscription, payload, ctx);

  if (result === "expired") {
    logger.info({ userId, userRole }, "notify: removing expired push subscription");
    void clearExpiredSubscription(userId, userRole);
    await markNotificationFailed({
      notificationId,
      error: "subscription_expired",
      provider: "web-push",
    });
    return;
  }

  if (result === "error") {
    // One retry after a short delay
    await new Promise<void>((resolve) => setTimeout(resolve, PUSH_RETRY_DELAY_MS));
    result = await attemptSend(subscription, payload, ctx);

    if (result === "expired") {
      logger.info({ userId, userRole }, "notify: removing expired push subscription (retry)");
      void clearExpiredSubscription(userId, userRole);
      await markNotificationFailed({
        notificationId,
        error: "subscription_expired",
        provider: "web-push",
      });
      return;
    }

    if (result === "error") {
      logger.warn({ userId, userRole, notificationId }, "notify: web push delivery failed after retry");
      await markNotificationFailed({
        notificationId,
        error: "web_push_failed",
        provider: "web-push",
      });
      return;
    }
  }

  logger.info({ userId, userRole, notificationId }, "notify: web push delivered successfully");

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
  logger.info(
    {
      userId: params.userId,
      userRole: params.userRole,
      type: params.type,
      url: params.url ?? null,
      actionType: params.actionType ?? null,
    },
    "notify: creating dual-channel notification (in-app + push)"
  );

  // Step 1: Always create an in-app notification record for the notification bell/center
  let inAppNotificationId: number | undefined;
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
        channel: "in_app",
        deliveryStatus: "delivered",
        deliveredAt: new Date(),
        provider: null,
      })
      .returning({ id: notificationsTable.id });
    inAppNotificationId = inserted?.id;
    if (inAppNotificationId === undefined) {
      logger.warn({ params }, "notify: in-app notification insert returned no id");
    } else {
      logger.info({ userId: params.userId, userRole: params.userRole, notificationId: inAppNotificationId }, "notify: in-app notification created");
    }
  } catch (err) {
    logger.error({ err, params }, "notify: failed to insert in-app notification record");
  }

  // Step 2: Create a separate push notification record and attempt delivery
  let pushNotificationId: number | undefined;
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
        channel: "push",
        deliveryStatus: "pending",
        provider: "web-push",
      })
      .returning({ id: notificationsTable.id });
    pushNotificationId = inserted?.id;
    if (pushNotificationId === undefined) {
      logger.warn({ params }, "notify: push notification insert returned no id — push delivery will be skipped");
    }
  } catch (err) {
    logger.error({ err, params }, "notify: failed to insert push notification record");
  }

  // If we couldn't create the push record, stop here (in-app notification is already saved)
  if (pushNotificationId === undefined) {
    return;
  }

  const deliveryUrl = buildPushTrackingUrl({
    userRole: params.userRole,
    notificationId: pushNotificationId,
    url: params.url,
    actionType: params.actionType,
    actionPayload: params.actionPayload ?? null,
  });

  // Step 3: Attempt push delivery via web-push
  void getPushSubscription(params.userId, params.userRole).then((sub) => {
    if (sub) {
      logger.info({ userId: params.userId, userRole: params.userRole, notificationId: pushNotificationId }, "notify: push subscription found");
      void sendWebPush(
        params.userId,
        params.userRole,
        sub,
        pushNotificationId,
        params.title,
        params.message,
        deliveryUrl,
        params.actionType,
        params.actionPayload ?? null,
        params.icon,
        params.badge
      );
      return;
    }
    logger.info({ userId: params.userId, userRole: params.userRole, notificationId: pushNotificationId }, "notify: no push subscription stored for recipient");
    void markNotificationFailed({
      notificationId: pushNotificationId,
      error: "no_push_subscription",
      provider: "web-push",
    });
  });
}

/** Use for direct recipient targeting without repeating role wiring at call sites. */
export async function sendToUser(
  userId: number,
  userRole: "client" | "driver" | "admin",
  params: Omit<Parameters<typeof notify>[0], "userId" | "userRole">
) {
  return notify({ userId, userRole, ...params });
}

/** Admin-specific helper used by the unified notification engine. */
export async function sendToAdmin(
  adminId: number,
  params: Omit<Parameters<typeof notify>[0], "userId" | "userRole">
) {
  return sendToUser(adminId, "admin", params);
}

/** Driver-specific helper used by the unified notification engine. */
export async function sendToDriver(
  driverId: number,
  params: Omit<Parameters<typeof notify>[0], "userId" | "userRole">
) {
  return sendToUser(driverId, "driver", params);
}

/** Broadcast helper for role-wide notifications while keeping one entrypoint. */
export async function sendBroadcast(params: {
  target: "admins" | "drivers";
} & Omit<Parameters<typeof notifyAllAdmins>[0], never>) {
  if (params.target === "admins") {
    return notifyAllAdmins(params);
  }
  return notifyAllDrivers(params);
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

/**
 * sendPushToUser — simple end-to-end push helper used by the /test route.
 *
 * Reads the push subscription from pushSubscriptionsTable, validates it, and
 * sends a web-push notification.  Returns { sent: false } on any recoverable
 * failure (no subscription, invalid subscription, 404/410 from push service).
 * Throws only on unexpected / non-recoverable errors.
 */
export async function sendPushToUser(
  userId: number,
  role: "client" | "driver" | "admin",
  params: { title: string; body: string; url?: string; tag?: string }
): Promise<{ sent: boolean }> {
  const vapid = getVapidConfig();
  if (!vapid) {
    const msg = "[push] VAPID keys are not configured — cannot send push notification";
    logger.error({ userId, role }, msg);
    throw new Error(msg);
  }

  logger.info({ userId, role }, "[push] sendPushToUser: looking up subscription");

  const subscriptionJson = await getPushSubscription(userId, role);
  if (!subscriptionJson) {
    logger.info({ userId, role }, "[push] sendPushToUser: no subscription found");
    return { sent: false };
  }

  // Parse and validate the subscription object
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(subscriptionJson) as Record<string, unknown>;
  } catch {
    logger.error({ userId, role }, "[push] sendPushToUser: subscription JSON is invalid — clearing");
    void clearExpiredSubscription(userId, role);
    return { sent: false };
  }

  const endpoint = parsed["endpoint"];
  const keys = parsed["keys"] as Record<string, unknown> | undefined;
  if (
    typeof endpoint !== "string" || !endpoint ||
    !keys ||
    typeof keys["p256dh"] !== "string" || !keys["p256dh"] ||
    typeof keys["auth"] !== "string" || !keys["auth"]
  ) {
    logger.error(
      { userId, role, hasEndpoint: !!endpoint, hasKeys: !!keys },
      "[push] sendPushToUser: subscription missing endpoint or keys — clearing"
    );
    void clearExpiredSubscription(userId, role);
    return { sent: false };
  }

  const subscription: webpush.PushSubscription = {
    endpoint: endpoint as string,
    keys: {
      p256dh: keys["p256dh"] as string,
      auth: keys["auth"] as string,
    },
  };

  // Re-apply VAPID at send time to pick up any runtime env changes
  webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    url: params.url ?? "/",
    tag: params.tag ?? "push-test",
  });

  logger.info({ userId, role }, "[push] sendPushToUser: sending notification");

  try {
    await webpush.sendNotification(subscription, payload);
    logger.info({ userId, role }, "[push] sendPushToUser: sent successfully");
    return { sent: true };
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number; body?: string };
    if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
      logger.warn({ userId, role, statusCode: pushErr.statusCode }, "[push] sendPushToUser: subscription expired — clearing");
      void clearExpiredSubscription(userId, role);
      return { sent: false };
    }
    logger.error({ err, userId, role }, "[push] sendPushToUser: unexpected error from push service");
    throw err;
  }
}
