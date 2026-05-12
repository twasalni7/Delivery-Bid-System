/**
 * push-notifications.ts — Web Push API Integration (VAPID)
 * استخدام Web Push API مباشرة بدلاً من OneSignal
 */

import { API_ORIGIN } from "@/lib/api-config";
import { appPath } from "@/lib/pwa-utils";

const LOG_PREFIX = "[Push]";

/**
 * تحويل VAPID public key من base64 إلى Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/**
 * الحصول على VAPID public key من السيرفر
 */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/push/vapid-public-key`);
    if (!res.ok) return null;
    const body = (await res.json()) as { publicKey?: string };
    return body.publicKey ?? null;
  } catch (err) {
    console.warn(LOG_PREFIX, "Failed to fetch VAPID public key:", err);
    return null;
  }
}

/**
 * تهيئة Service Worker
 */
export async function initPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn(LOG_PREFIX, "المتصفح لا يدعم الإشعارات");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(appPath("sw.js"), {
      scope: appPath(),
    });
    await navigator.serviceWorker.ready;
    console.log(LOG_PREFIX, "Service Worker registered ✓");
  } catch (err) {
    console.warn(LOG_PREFIX, "Service Worker registration failed:", err);
  }
}

/**
 * الاشتراك في الإشعارات
 */
export async function subscribeToPush(
  role?: string
): Promise<"ok" | "already_subscribed" | "server_error" | "unsupported" | "denied"> {
  if (!('Notification' in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    // 1. تأكد من تسجيل Service Worker
    const registration = await navigator.serviceWorker.register(appPath("sw.js"), {
      scope: appPath(),
    });
    await navigator.serviceWorker.ready;

    // 2. احصل على VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.error(LOG_PREFIX, "VAPID public key not available");
      return "server_error";
    }

    // 3. اطلب الإذن
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    // 4. تحقق من وجود اشتراك قديم
    const existingSub = await registration.pushManager.getSubscription();
    let subscription: PushSubscription;

    if (existingSub) {
      subscription = existingSub;
      console.log(LOG_PREFIX, "Using existing subscription");
    } else {
      // 5. أنشئ اشتراك جديد
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      console.log(LOG_PREFIX, "New subscription created");
    }

    // 6. أرسل الاشتراك للباكند
    const response = await fetch(`${API_ORIGIN}/api/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!response.ok) {
      console.error(LOG_PREFIX, "Failed to save subscription on server");
      return "server_error";
    }

    console.log(LOG_PREFIX, "Subscription saved to server ✓");
    return "ok";
  } catch (err) {
    console.error(LOG_PREFIX, "subscribeToPush error:", err);
    return "server_error";
  }
}

/**
 * إلغاء الاشتراك
 */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration(appPath());
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log(LOG_PREFIX, "Local subscription removed ✓");
    }

    // أخبر السيرفر بإلغاء الاشتراك
    await fetch(`${API_ORIGIN}/api/push/unsubscribe`, {
      method: 'POST',
      credentials: 'include',
    });
    console.log(LOG_PREFIX, "Server subscription removed ✓");
  } catch (err) {
    console.warn(LOG_PREFIX, "unsubscribeFromPush error:", err);
  }
}

/**
 * طلب إذن الإشعارات يدوياً (زر "فعّل الإشعارات")
 */
export async function requestPushPermission(): Promise<"granted" | "denied" | "default"> {
  if (!('Notification' in window)) return "default";

  try {
    const permission = await Notification.requestPermission();
    return permission as "granted" | "denied" | "default";
  } catch (err) {
    console.warn(LOG_PREFIX, "requestPushPermission error:", err);
    return "default";
  }
}

/**
 * التحقق من حالة الاشتراك
 */
export async function checkPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, permission: "default", subscribed: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(appPath());
    if (!registration) {
      return { supported: true, permission: Notification.permission, subscribed: false };
    }

    const subscription = await registration.pushManager.getSubscription();
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: !!subscription,
    };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
}

/** للتوافق مع الكود القديم */
export function clearPushSubscriptionCache(): void {
  localStorage.removeItem("push_subscribed");
}

// دوال فارغة للتوافق مع الكود القديم الذي يستدعي loginOneSignal/logoutOneSignal
export async function loginOneSignal(_userId: number, _role: string): Promise<void> {
  // No-op: Web Push doesn't need login/logout
}

export async function logoutOneSignal(): Promise<void> {
  // No-op: Web Push doesn't need login/logout
}

export async function initOneSignal(): Promise<void> {
  // No-op: replaced by initPushNotifications
}
