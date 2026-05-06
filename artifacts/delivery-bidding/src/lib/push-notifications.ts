import { API_ORIGIN } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { appPath, isSecurePushContext } from "@/lib/pwa-utils";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";
const LOG_PREFIX = "[Push]";

export type PushSubscribeResult =
  | "ok"
  | "already_subscribed"
  | "unsupported"
  | "permission_denied"
  | "permission_default"
  | "insecure_context"
  | "no_vapid_key"
  | "sw_error"
  | "subscribe_error"
  | "server_error";

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

  // Guard: ensure the browser returned a complete subscription with real keys.
  // An incomplete toJSON() would cause a 400 on the server and is unsaveable.
  if (
    !subJson.endpoint ||
    !subJson.keys?.p256dh ||
    !subJson.keys?.auth
  ) {
    throw new Error(
      `PushSubscription.toJSON() returned incomplete data: endpoint=${!!subJson.endpoint} p256dh=${!!subJson.keys?.p256dh} auth=${!!subJson.keys?.auth}`
    );
  }

  const authHeaders = getAuthHeaders();
  const requestPayload = { subscription: subJson, role };

  // ── DIAGNOSTIC: log subscription before sending ──────────────────────────
  console.log(LOG_PREFIX, "DIAG — subscription toJSON before send:", subJson);
  console.log(LOG_PREFIX, "DIAG — request payload:", JSON.stringify(requestPayload));
  console.log(LOG_PREFIX, "DIAG — auth headers present:", Object.keys(authHeaders));
  console.log(LOG_PREFIX, "DIAG — target URL:", `${API_ORIGIN}/api/push/subscribe`);

  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(requestPayload),
    });
  } catch (networkErr) {
    console.error(LOG_PREFIX, "DIAG — fetch NETWORK ERROR (CORS / offline / DNS?):", networkErr);
    throw networkErr;
  }

  const body = await res.text().catch(() => "");

  // ── DIAGNOSTIC: log full response ────────────────────────────────────────
  console.log(LOG_PREFIX, "DIAG — fetch response:", {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    body,
    headers: Object.fromEntries(res.headers.entries()),
  });

  if (!res.ok) {
    console.error(LOG_PREFIX, "POST /api/push/subscribe failed:", {
      status: res.status,
      statusText: res.statusText,
      body,
    });
    throw new Error(`POST /api/push/subscribe failed: HTTP ${res.status} ${body || res.statusText}`);
  }
  console.log(LOG_PREFIX, "POST /api/push/subscribe succeeded ✓", {
    status: res.status,
    body,
  });
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const swUrl = appPath("sw.js");
  const swScope = appPath();

  console.log(LOG_PREFIX, "ensuring service worker registration", {
    swUrl,
    swScope,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    isSecureContext: window.isSecureContext,
  });

  try {
    const existingRegistration = await navigator.serviceWorker.getRegistration(swScope);

    if (existingRegistration) {
      console.log(LOG_PREFIX, "using existing service worker registration ✓", existingRegistration.scope);
      return existingRegistration;
    }

    const registration = await navigator.serviceWorker.register(swUrl, { scope: swScope });
    await navigator.serviceWorker.ready;
    console.log(LOG_PREFIX, "service worker registered from subscribe flow ✓", registration.scope);
    return registration;
  } catch (err) {
    console.error(LOG_PREFIX, "service worker registration failed:", err);
    throw err;
  }
}

export async function subscribeToPush(role?: string): Promise<PushSubscribeResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn(LOG_PREFIX, "push not supported in this browser");
    return "unsupported";
  }

  if (!isSecurePushContext()) {
    console.error(LOG_PREFIX, "Push subscription requires HTTPS (or localhost) because the page is not in a secure context.", {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSecureContext: window.isSecureContext,
    });
    return "insecure_context";
  }

  // If cached as subscribed, verify the subscription still exists;
  // if the browser unsubscribed (e.g. subscription expired), clear the cache
  // so the full flow runs again.
  if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") {
    try {
      const reg = await ensureServiceWorkerRegistration();
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        console.log(LOG_PREFIX, "cached subscription no longer valid — clearing cache and re-subscribing");
        localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
      } else {
        console.log(LOG_PREFIX, "already subscribed (cache hit), skipping");
        return "already_subscribed";
      }
    } catch (err) {
      console.warn(LOG_PREFIX, "could not verify existing subscription, clearing cache:", err);
      localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    }
  }

  let permission = Notification.permission;
  if (permission === "default") {
    console.log(LOG_PREFIX, "requesting notification permission");
    permission = await Notification.requestPermission();
    console.log(LOG_PREFIX, `notification permission: ${permission}`);
  } else {
    console.log(LOG_PREFIX, `notification permission (pre-existing): ${permission}`);
  }
  if (permission === "denied") {
    console.warn(LOG_PREFIX, "notification permission denied");
    return "permission_denied";
  }
  if (permission !== "granted") {
    console.warn(LOG_PREFIX, "notification permission not granted — aborting");
    return "permission_default";
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await ensureServiceWorkerRegistration();
    console.log(LOG_PREFIX, "service worker ready ✓", registration.scope);
  } catch (err) {
    console.error(LOG_PREFIX, "service worker not ready:", err);
    return "sw_error";
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) {
    console.error(LOG_PREFIX, "aborting: no VAPID public key");
    return "no_vapid_key";
  }

  let subscription: PushSubscription;
  try {
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      subscription = existingSubscription;
      console.log(LOG_PREFIX, "existing push subscription found ✓", subscription.endpoint);
    } else {
      console.log(LOG_PREFIX, "creating push subscription");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
      });
      console.log(LOG_PREFIX, "push subscription created ✓", subscription.endpoint);
    }
  } catch (err) {
    console.error(LOG_PREFIX, "push subscription creation failed:", err);
    return "subscribe_error";
  }

  try {
    await saveSubscription(subscription, role);
    localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
    console.log(LOG_PREFIX, "push notifications fully enabled ✓");
    return "ok";
  } catch {
    // saveSubscription already logged the error
    console.error(LOG_PREFIX, "push enabled in browser but failed to save to server — will retry on next load");
    return "server_error";
  }
}
