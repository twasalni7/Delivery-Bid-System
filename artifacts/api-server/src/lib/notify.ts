import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ONESIGNAL_APP_ID = process.env["ONESIGNAL_APP_ID"] || "";
const ONESIGNAL_REST_API_KEY = process.env["ONESIGNAL_REST_API_KEY"] || "";
const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

/**
 * إرسال إشعار عبر OneSignal REST API
 * يستخدم external_user_id لاستهداف المستخدم المحدد
 */
async function sendOneSignalNotification(params: {
  externalUserId: string;
  title: string;
  body: string;
  url?: string;
  notificationId?: number;
}): Promise<"ok" | "error"> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    logger.warn("[OneSignal] App ID or REST API Key not configured");
    return "error";
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: [params.externalUserId] },
    target_channel: "push",
    headings: { ar: params.title, en: params.title },
    contents: { ar: params.body, en: params.body },
    url: params.url ?? "/",
    data: {
      notificationId: params.notificationId,
      url: params.url ?? "/",
    },
    android_channel_id: "twasalni-default",
    ttl: 86400,
  };

  try {
    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { id?: string; errors?: unknown; recipients?: number };

    if (!res.ok || data.errors) {
      logger.warn({ errors: data.errors, externalUserId: params.externalUserId }, "[OneSignal] Failed to send notification");
      return "error";
    }

    logger.info(
      { id: data.id, recipients: data.recipients, externalUserId: params.externalUserId },
      "[OneSignal] Notification sent ✓"
    );
    return "ok";
  } catch (err) {
    logger.error({ err, externalUserId: params.externalUserId }, "[OneSignal] Network error");
    return "error";
  }
}

/**
 * إرسال إشعار لمستخدم محدد بدور محدد
 */
export async function sendPushToUser(
  userId: number,
  role: "client" | "driver" | "admin",
  params: { title: string; body: string; url?: string; tag?: string }
): Promise<{ sent: boolean }> {
  const externalUserId = `${role}_${userId}`;
  const result = await sendOneSignalNotification({
    externalUserId,
    title: params.title,
    body: params.body,
    url: params.url,
  });
  return { sent: result === "ok" };
}

/**
 * الدالة الرئيسية: تسجل الإشعار في DB وترسله عبر OneSignal
 */
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
        relatedId: params.relatedId,
        url: params.url,
        actionType: params.actionType ?? "open_url",
        actionLabel: params.actionLabel,
        actionPayload: params.actionPayload ?? null,
        isRead: false,
      })
      .returning({ id: notificationsTable.id });

    notificationId = inserted?.id;
    logger.info({ notificationId, userId: params.userId }, "notify: notification saved to DB ✓");
  } catch (err) {
    logger.error({ err, userId: params.userId }, "notify: failed to save notification to DB");
    return;
  }

  // إرسال عبر OneSignal
  const externalUserId = `${params.userRole}_${params.userId}`;
  const result = await sendOneSignalNotification({
    externalUserId,
    title: params.title,
    body: params.message,
    url: params.url,
    notificationId,
  });

  // تحديث delivered_at إذا نجح الإرسال
  if (result === "ok" && notificationId !== undefined) {
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

/**
 * إرسال إشعار لجميع السائقين النشطين
 */
export async function notifyAllDrivers(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    logger.warn("[OneSignal] Cannot notify all drivers — keys not configured");
    return;
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    filters: [{ field: "tag", key: "role", relation: "=", value: "driver" }],
    headings: { ar: params.title, en: params.title },
    contents: { ar: params.message, en: params.message },
    url: params.url ?? "/driver/dashboard",
    ttl: 86400,
  };

  try {
    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { id?: string; recipients?: number };
    logger.info({ id: data.id, recipients: data.recipients }, "[OneSignal] notifyAllDrivers sent ✓");
  } catch (err) {
    logger.error({ err }, "[OneSignal] notifyAllDrivers failed");
  }
}

/**
 * إرسال إشعار لجميع الأدمن
 */
export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    logger.warn("[OneSignal] Cannot notify all admins — keys not configured");
    return;
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    filters: [{ field: "tag", key: "role", relation: "=", value: "admin" }],
    headings: { ar: params.title, en: params.title },
    contents: { ar: params.message, en: params.message },
    url: params.url ?? "/admin/dashboard",
    ttl: 86400,
  };

  try {
    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { id?: string; recipients?: number };
    logger.info({ id: data.id, recipients: data.recipients }, "[OneSignal] notifyAllAdmins sent ✓");
  } catch (err) {
    logger.error({ err }, "[OneSignal] notifyAllAdmins failed");
  }
}
