import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";

export async function notify(params: {
  userId: number;
  userRole: "client" | "driver" | "admin";
  title: string;
  message: string;
  type: "offer" | "request" | "system" | "support";
  relatedId?: number;
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
}
