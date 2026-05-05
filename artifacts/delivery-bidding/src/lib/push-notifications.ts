import { API_ORIGIN } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";
const LOG_PREFIX = "[Push]";

export function clearPushSubscriptionCache(): void {
  localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
  console.log(LOG_PREFIX, "subscription cache cleared");
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    array[i] = rawData.charCodeAt(i);
  }
  return array.buffer;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/push/vapid-public-key`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(LOG_PREFIX, `VAPID key fetch failed: HTTP ${res.status}`, body);
      return null;
    }
    const data = (await res.json()) as { publicKey?: string };
    if (!data.publicKey) {
      console.error(LOG_PREFIX, "VAPID key fetch succeeded but response has no publicKey field", data);
      return null;
    }
    console.log(LOG_PREFIX, "VAPID public key fetched successfully");
    return data.publicKey;
  } catch (err) {
    console.error(LOG_PREFIX, "VAPID key fetch threw an exception:", err);
    return null;
  }
}

async function saveSubscription(
  subscription: PushSubscription,
  role?: string
): Promise<void> {
  const subJson = subscription.toJSON();
  console.log(LOG_PREFIX, "sending subscription to server:", {
    endpoint: subJson.endpoint,
    hasP256dh: Boolean(subJson.keys?.p256dh),
    hasAuth: Boolean(subJson.keys?.auth),
    role,
  });
  try {
    const res = await fetch(`${API_ORIGIN}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ subscription: subJson, role }),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      console.error(LOG_PREFIX, `save subscription failed: HTTP ${res.status}`, body);
      throw new Error(`save subscription HTTP ${res.status}`);
    }
    console.log(LOG_PREFIX, "subscription saved to server ✓ — server response:", body);
  } catch (err) {
    console.error(LOG_PREFIX, "save subscription threw an exception:", err);
    throw err;
  }
}

export async function subscribeToPush(role?: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn(LOG_PREFIX, "push not supported in this browser");
    return;
  }

  // If cached as subscribed, verify the subscription still exists;
  // if the browser unsubscribed (e.g. subscription expired), clear the cache
  // so the full flow runs again.
  if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        console.log(LOG_PREFIX, "cached subscription no longer valid — clearing cache and re-subscribing");
        localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
      } else {
        console.log(LOG_PREFIX, "already subscribed (cache hit), skipping");
        return;
      }
    } catch (err) {
      console.warn(LOG_PREFIX, "could not verify existing subscription, clearing cache:", err);
      localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    }
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
    console.log(LOG_PREFIX, `notification permission: ${permission}`);
  } else {
    console.log(LOG_PREFIX, `notification permission (pre-existing): ${permission}`);
  }
  if (permission !== "granted") {
    console.warn(LOG_PREFIX, "notification permission not granted — aborting");
    return;
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
    console.log(LOG_PREFIX, "service worker ready ✓", registration.scope);
  } catch (err) {
    console.error(LOG_PREFIX, "service worker not ready:", err);
    return;
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) {
    console.error(LOG_PREFIX, "aborting: no VAPID public key");
    return;
  }

  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    });
    console.log(LOG_PREFIX, "push subscription created ✓", subscription.endpoint);
  } catch (err) {
    console.error(LOG_PREFIX, "push subscription creation failed:", err);
    return;
  }

  try {
    await saveSubscription(subscription, role);
    localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
    console.log(LOG_PREFIX, "push notifications fully enabled ✓");
  } catch {
    // saveSubscription already logged the error
    console.error(LOG_PREFIX, "push enabled in browser but failed to save to server — will retry on next load");
  }
}
