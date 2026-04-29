import { API_ORIGIN } from "@/lib/api-config";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";

/**
 * Convert a base64url string to a Uint8Array (needed for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Fetch the VAPID public key from the API.
 */
async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/push/vapid-public-key`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

/**
 * Send the push subscription object (and the caller's role) to the backend.
 * The role is already known server-side via the session; we also send it
 * explicitly so the server can double-check and route correctly.
 */
async function saveSubscription(
  subscription: PushSubscription,
  role?: string
): Promise<void> {
  await fetch(`${API_ORIGIN}/api/push/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), role }),
  });
}

/**
 * Request notification permission, subscribe via pushManager, and
 * save the subscription to the backend.
 *
 * @param role - Optional user role ("driver" | "client" | "admin").
 *               Forwarded to the backend alongside the subscription so the
 *               correct table row is updated.
 *
 * Safe to call multiple times — it short-circuits if already subscribed
 * or if permission is denied.
 */
export async function subscribeToPush(role?: string): Promise<void> {
  // Only run in browsers with Service Worker + PushManager support
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  // Don't re-subscribe if already done in this browser
  if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") return;

  // Ask for permission
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  // Get the registered service worker
  const registration = await navigator.serviceWorker.ready;

  // Fetch VAPID public key
  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) return;

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  // Send to backend (role forwarded for explicit routing)
  await saveSubscription(subscription, role);

  // Mark as done so we don't re-subscribe on every login
  localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
}

