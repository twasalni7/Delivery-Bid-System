import webpush from "web-push";
import { db } from "@workspace/db";
import { notificationsTable, clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── VAPID setup ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"];
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── Retrieve push subscription for a user ───────────────────────────────────
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
  } catch {
    // ignore
  }
  return null;
}

// ─── Send a web push notification ────────────────────────────────────────────
async function sendWebPush(
  subscriptionJson: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url: url ?? "/" })
    );
  } catch {
    // Silent — push failures are non-critical (subscription may have expired)
  }
}

// ─── Main notify function ─────────────────────────────────────────────────────
export async function notify(params: {
  userId: number;
  userRole: "client" | "driver" | "admin";
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
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
  } catch {
    // Silent — notifications are non-critical
  }

  // Fire-and-forget web push
  void getPushSubscription(params.userId, params.userRole).then((sub) => {
    if (sub) {
      void sendWebPush(sub, params.title, params.message, params.url);
    }
  });
}

// ─── Notify all admin users ───────────────────────────────────────────────────
export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
  url?: string;
}) {
  try {
    const admins = await db.select({ id: adminsTable.id }).from(adminsTable);
    for (const admin of admins) {
      void notify({ userId: admin.id, userRole: "admin", ...params });
    }
  } catch {
    // Silent
  }
}

// ─── Convenience export for direct use ───────────────────────────────────────
export { sendWebPush };
