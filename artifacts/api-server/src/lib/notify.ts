import webpush from "web-push";
import { db, pool } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable, driversTable, adminsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

// ─── OneSignal REST API ────────────────────────────────────────────────────────

const ONESIGNAL_APP_ID = process.env["ONESIGNAL_APP_ID"] ?? "";
const ONESIGNAL_REST_API_KEY = process.env["ONESIGNAL_REST_API_KEY"] ?? "";

function isOneSignalConfigured(): boolean {
  return !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);
}

/**
 * إرسال إشعار عبر OneSignal REST API بالاستهداف بـ external_id
 * external_id = "<role>:<userId>" — نفس الصيغة المستخدمة في الفرونت
 */
async function sendOneSignalNotification(params: {
  userId: number;
  userRole: "client" | "driver" | "admin";
  notificationId?: number;
  title: string;
  body: string;
  url?: string;
  actionType?: "open_url" | "emit_event";
  actionPayload?: Record<string, unknown> | null;
}): Promise<boolean> {
  if (!isOneSignalConfigured()) {
    logger.warn({ userId: params.userId }, "OneSignal: not configured — ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing");
    return false;
  }

  const externalId = `${params.userRole}:${params.userId}`;
  const targetUrl = params.url ?? "/";

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    // استهداف المستخدم بـ external_id
    include_aliases: { external_id: [externalId] },
    target_channel: "push",
    headings: { ar: params.title, en: params.title },
    contents: { ar: params.body, en: params.body },
    url: targetUrl.startsWith("http") ? targetUrl : `https://sharq.it.com${targetUrl}`,
    // بيانات إضافية للـ service worker
    data: {
      notificationId: params.notificationId,
      actionType: params.actionType ?? "open_url",
      actionPayload: params.actionPayload ?? null,
      url: targetUrl,
    },
    // إعدادات العرض
    android_channel_id: "twasalni-default",
    ttl: 86400, // يوم كامل
  };

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      logger.warn(
        { userId: params.userId, userRole: params.userRole, status: res.status, body: responseBody },
        "OneSignal: API request failed"
      );
      return false;
    }

    const recipients = (responseBody["recipients"] as number) ?? 0;
    logger.info(
      { userId: params.userId, userRole: params.userRole, externalId, recipients, id: responseBody["id"] },
      `OneSignal: notification sent — ${recipients} recipient(s)`
    );

    return recipients > 0;
  } catch (err) {
    logger.error({ err, userId: params.userId, userRole: params.userRole }, "OneSignal: fetch error");
    return false;
  }
}

// ─── VAPID fallback ───────────────────────────────────────────────────────────

function getVapidConfig(): { public: string; private: string; subject: string } | null {
  const pub = process.env["VAPID_PUBLIC_KEY"];
  const priv = process.env["VAPID_PRIVATE_KEY"];
  if (!pub || !priv) return null;
  const subject = process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app";
  return { public: pub, private: priv, subject };
}

(function initVapid() {
  const vapid = getVapidConfig();
  if (vapid) {
    webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);
    logger.info("[push] VAPID details initialized at module load");
  } else {
    logger.warn("[push] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing — VAPID push disabled");
  }
})();

function normalizeSubscriptionData(data: Record<string, unknown>): Record<string, unknown> {
  if (typeof data["endpoint"] === "string" && data["endpoint"]) {
    return data;
  }
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
      `SELECT subscription_data FROM push_subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
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
        logger.warn({ err: legacyErr, userId, userRole }, "notify: failed to clear expired legacy push subscription");
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
    const normalized = normalizeSubscriptionData(row.subscriptionData as Record<string, unknown>);
    return JSON.stringify(normalized);
  } catch (err) {
    if (shouldFallbackToLegacyPushSchema(err)) {
      logger.warn({ err, userId, userRole }, "notify: modern push schema unavailable, falling back to legacy");
      return getLegacyPushSubscription(userId);
    }
    logger.warn({ err, userId, userRole }, "notify: failed to fetch push subscription");
  }
  return null;
}

type SendResult = "ok" | "expired" | "error";

async function attemptVapidSend(
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
      "notify: VAPID web push attempt failed"
    );
    return "error";
  }
}

async function sendVapidFallback(
  userId: number,
  userRole: "client" | "driver" | "admin",
  subscriptionJson: string,
  notificationId: number | undefined,
  title: string,
  body: string,
  url?: string,
  actionType?: "open_url" | "emit_event",
  actionPayload?: Record<string, unknown> | null
): Promise<boolean> {
  const vapid = getVapidConfig();
  if (!vapid) return false;

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
  } catch {
    logger.warn({ userId, userRole }, "notify: invalid VAPID subscription JSON");
    void clearExpiredSubscription(userId, userRole);
    return false;
  }

  // رفض FCM Legacy endpoints
  const endpoint = (subscription as unknown as { endpoint?: string }).endpoint ?? "";
  if (endpoint.includes("fcm.googleapis.com/fcm/send")) {
    logger.warn({ userId, userRole }, "notify: VAPID skipped — FCM Legacy endpoint detected, clearing");
    void clearExpiredSubscription(userId, userRole);
    return false;
  }

  webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);

  const payload = JSON.stringify({
    title,
    body,
    notificationId,
    url: url ?? "/",
    actionType: actionType ?? "open_url",
    actionPayload: actionPayload ?? null,
  });

  const ctx = { userId, userRole };
  let result = await attemptVapidSend(subscription, payload, ctx);

  if (result === "expired") {
    void clearExpiredSubscription(userId, userRole);
    return false;
  }

  if (result === "error") {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    result = await attemptVapidSend(subscription, payload, ctx);
    if (result !== "ok") {
      if (result === "expired") void clearExpiredSubscription(userId, userRole);
      return false;
    }
  }

  logger.info({ userId, userRole, notificationId }, "notify: VAPID fallback delivered successfully");

  if (notificationId !== undefined) {
    try {
      await db.update(notificationsTable).set({ deliveredAt: new Date() }).where(eq(notificationsTable.id, notificationId));
    } catch (err) {
      logger.warn({ err, notificationId }, "notify: failed to update delivered_at after VAPID send");
    }
  }
  return true;
}

// ─── Main notify() ────────────────────────────────────────────────────────────

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
    { userId: params.userId, userRole: params.userRole, type: params.type },
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
  } catch (err) {
    logger.error({ err, params }, "notify: failed to insert notification record");
  }

  // ── الإرسال: OneSignal أولاً، ثم VAPID كـ fallback ──────────────────────
  void (async () => {
    // 1. حاول OneSignal أولاً
    const oneSignalSent = await sendOneSignalNotification({
      userId: params.userId,
      userRole: params.userRole,
      notificationId,
      title: params.title,
      body: params.message,
      url: params.url,
      actionType: params.actionType,
      actionPayload: params.actionPayload ?? null,
    });

    if (oneSignalSent) {
      // تحديث delivered_at
      if (notificationId !== undefined) {
        try {
          await db.update(notificationsTable).set({ deliveredAt: new Date() }).where(eq(notificationsTable.id, notificationId));
        } catch (err) {
          logger.warn({ err, notificationId }, "notify: failed to update delivered_at after OneSignal send");
        }
      }
      return;
    }

    // 2. OneSignal فشل أو غير مُهيأ — جرّب VAPID كـ fallback
    logger.info({ userId: params.userId, userRole: params.userRole }, "notify: OneSignal failed/unconfigured — trying VAPID fallback");
    const sub = await getPushSubscription(params.userId, params.userRole);
    if (sub) {
      await sendVapidFallback(
        params.userId,
        params.userRole,
        sub,
        notificationId,
        params.title,
        params.message,
        params.url,
        params.actionType,
        params.actionPayload ?? null
      );
    } else {
      logger.info({ userId: params.userId, userRole: params.userRole }, "notify: no push subscription — notification saved to DB only");
    }
  })();
}

// ─── Bulk helpers ─────────────────────────────────────────────────────────────

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

export { sendVapidFallback as sendWebPush };

/**
 * sendPushToUser — للاختبار المباشر عبر /api/push/test
 */
export async function sendPushToUser(
  userId: number,
  role: "client" | "driver" | "admin",
  params: { title: string; body: string; url?: string; tag?: string }
): Promise<{ sent: boolean; method?: string }> {
  // جرّب OneSignal أولاً
  if (isOneSignalConfigured()) {
    const sent = await sendOneSignalNotification({
      userId,
      userRole: role,
      title: params.title,
      body: params.body,
      url: params.url,
    });
    if (sent) return { sent: true, method: "onesignal" };
  }

  // fallback: VAPID
  const vapid = getVapidConfig();
  if (!vapid) {
    logger.error({ userId, role }, "[push] sendPushToUser: neither OneSignal nor VAPID configured");
    return { sent: false };
  }

  const subscriptionJson = await getPushSubscription(userId, role);
  if (!subscriptionJson) {
    logger.info({ userId, role }, "[push] sendPushToUser: no subscription found");
    return { sent: false };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(subscriptionJson) as Record<string, unknown>;
  } catch {
    void clearExpiredSubscription(userId, role);
    return { sent: false };
  }

  const endpoint = parsed["endpoint"];
  const keys = parsed["keys"] as Record<string, unknown> | undefined;
  if (
    typeof endpoint !== "string" || !endpoint ||
    !keys ||
    typeof keys["p256dh"] !== "string" ||
    typeof keys["auth"] !== "string"
  ) {
    void clearExpiredSubscription(userId, role);
    return { sent: false };
  }

  if ((endpoint as string).includes("fcm.googleapis.com/fcm/send")) {
    logger.warn({ userId, role }, "[push] FCM Legacy endpoint — clearing and skipping");
    void clearExpiredSubscription(userId, role);
    return { sent: false };
  }

  webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);

  const subscription: webpush.PushSubscription = {
    endpoint: endpoint as string,
    keys: { p256dh: keys["p256dh"] as string, auth: keys["auth"] as string },
  };

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: params.title, body: params.body, url: params.url ?? "/", tag: params.tag ?? "push-test" })
    );
    return { sent: true, method: "vapid" };
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number };
    if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
      void clearExpiredSubscription(userId, role);
    }
    return { sent: false };
  }
}
