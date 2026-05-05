import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  url: string | null;
  actionType?: "open_url" | "emit_event" | null;
  actionLabel?: string | null;
  actionPayload?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
  interactedAt?: string | null;
  interactionSource?: string | null;
  interactionType?: string | null;
};

const TRACKING_PARAM_KEYS = [
  "notificationId",
  "notificationSource",
  "notificationAction",
  "notificationEvent",
  "notificationPayload",
] as const;

function resolveSafeRelativeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin || target.protocol === "javascript:") return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    if (/^\/[^/]/.test(url) || url === "/") return url;
    return null;
  }
}

async function postInteraction(notificationId: number, source: "in_app" | "push", action: "open" | "action") {
  await fetch(`${API}/api/notifications/${notificationId}/interact`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ source, action }),
  });
}

function dispatchNotificationEvent(eventName: string | null | undefined, payload?: Record<string, unknown> | null) {
  if (!eventName) return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload ?? null }));
}

export async function executeNotificationAction(
  notification: AppNotification,
  source: "in_app" | "push" = "in_app"
) {
  const action = notification.actionType === "emit_event" ? "action" : "open";
  void postInteraction(notification.id, source, action);

  if (notification.actionType === "emit_event") {
    const eventName =
      typeof notification.actionPayload?.["eventName"] === "string"
        ? notification.actionPayload["eventName"]
        : null;
    dispatchNotificationEvent(eventName, notification.actionPayload);
  }

  const safeUrl = resolveSafeRelativeUrl(notification.url);
  if (safeUrl) {
    window.location.assign(safeUrl);
  }
}

export async function consumePendingNotificationInteraction() {
  const currentUrl = new URL(window.location.href);
  const notificationId = Number(currentUrl.searchParams.get("notificationId") ?? "");
  const source = currentUrl.searchParams.get("notificationSource") === "push" ? "push" : "in_app";
  const action = currentUrl.searchParams.get("notificationAction") === "action" ? "action" : "open";
  const eventName = currentUrl.searchParams.get("notificationEvent");
  const payloadRaw = currentUrl.searchParams.get("notificationPayload");

  if (!Number.isFinite(notificationId)) return;

  let payload: Record<string, unknown> | null = null;
  if (payloadRaw) {
    try {
      payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  try {
    await postInteraction(notificationId, source, action);
    if (action === "action") {
      dispatchNotificationEvent(eventName, payload);
    }
  } finally {
    for (const key of TRACKING_PARAM_KEYS) currentUrl.searchParams.delete(key);
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }
}
