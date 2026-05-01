import { API_ORIGIN } from "@/lib/api-config";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";

export function clearPushSubscriptionCache(): void {
  localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

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

export async function subscribeToPush(role?: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") return;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await saveSubscription(subscription, role);
  localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
}
