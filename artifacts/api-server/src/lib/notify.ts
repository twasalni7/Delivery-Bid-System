import webpush from "web-push";
import { db } from "@workspace/db";
import { notificationsTable, clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"];
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function clearExpiredSubscription(userId: number, userRole: "client" | "driver" | "admin") {
  try {
    if (userRole === "client") {
      await db.update(clientsTable).set({ pushSubscription: null }).where(eq(clientsTable.id, userId));
    } else if (userRole === "driver") {
      await db.update(driversTable).set({ pushSubscription: null }).where(eq(driversTable.id, userId));
    } else if (userRole === "admin") {
      await db.update(adminsTable).set({ pushSubscription: null }).where(eq(adminsTable.id, userId));
    }
  } catch (err) {
    logger.warn({ err, userId, userRole }, "notify: failed to clear expired push subscription");
  }
}

async function getPushSubscription(
  userId: number,
  userRole: "client" | "driver" | "admin"
): Promise<string | null> {
  try {
    if (userRole === "client") {
      const row = await db.query.clientsTable.findFirst({
        where: eq(clientsTable.id, userId),
        columns: { pushSubscription: true },
      });
      return row?.pushSubscription ?? null;
    }
    if (userRole === "driver") {
      const row = await db.query.driversTable.findFirst({
        where: eq(driversTable.id, userId),
        columns: { pushSubscription: true },
      });
      return row?.pushSubscription ?? null;
    }
    if (userRole === "admin") {
      const row = await db.query.adminsTable.findFirst({
        where: eq(adminsTable.id, userId),
        columns: { pushSubscription: true },
      });
      return row?.pushSubscription ?? null;
    }
  } catch (err) {
    logger.warn({ err, userId, userRole }, "notify: failed to fetch push subscription");
  }
  return null;
}

async function sendWebPush(
  userId: number,
  userRole: "client" | "driver" | "admin",
  subscriptionJson: string,
  title: string,
  body: string,
  url?: string,
  icon?: string,
  badge?: string
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body,
        url: url ?? "/",
        icon: icon ?? "/icons/icon-192.png",
        badge: badge ?? "/icons/icon-192.png",
      })
    );
  } catch (err: unknown) {
    const pushErr = err as { statusCode?: number };
    if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
      logger.info({ userId, userRole }, "notify: removing expired push subscription");
      void clearExpiredSubscription(userId, userRole);
    } else {
      logger.warn({ err, userId, userRole }, "notify: web push delivery failed");
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
  try {
    await db.insert(notificationsTable).values({
      userId: params.userId,
      userRole: params.userRole,
      title: params.title,
      message: params.message,
      type: params.type,
      relatedId: params.relatedId ?? null,
      isRead: false,
    });
  } catch (err) {
    logger.error({ err, params }, "notify: failed to insert notification record");
  }

  void getPushSubscription(params.userId, params.userRole).then((sub) => {
    if (sub) {
      void sendWebPush(
        params.userId,
        params.userRole,
        sub,
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
