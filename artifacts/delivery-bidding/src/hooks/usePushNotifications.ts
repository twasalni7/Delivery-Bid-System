import { useEffect, useState, useCallback } from "react";
import { API_ORIGIN } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

type NotificationPermissionState = "default" | "granted" | "denied";

interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    array[i] = rawData.charCodeAt(i);
  }
  return array.buffer as ArrayBuffer;
}

function checkSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * usePushNotifications
 *
 * هوك يدير دورة حياة اشتراك الإشعارات بالكامل:
 * التسجيل، طلب الإذن، الاشتراك عبر VAPID، وإلغاء الاشتراك.
 *
 * يرسل pushSubscription.toJSON() مباشرةً (flat) إلى POST /api/push/subscribe.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const isSupported = checkSupport();

  const [permission, setPermission] = useState<NotificationPermissionState>(
    isSupported ? Notification.permission : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupported);
  const [error, setError] = useState<string | null>(null);

  // On mount, check if a push subscription already exists in the browser
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const checkSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(!!existing);
          setPermission(Notification.permission);
        }
      } catch {
        // Cannot verify — default to not subscribed
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkSubscription().catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isSupported) {
        throw new Error("الإشعارات غير مدعومة في هذا المتصفح");
      }

      // 1. Register service worker
      let reg: ServiceWorkerRegistration;
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        reg = existing ?? await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      } catch (err) {
        console.error("[push] service worker registration failed:", err);
        throw new Error("فشل تسجيل service worker");
      }

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error(perm === "denied" ? "تم رفض إذن الإشعارات" : "لم يتم منح إذن الإشعارات");
      }

      // 3. Fetch VAPID public key
      const vapidRes = await fetch(`${API_ORIGIN}/api/push/vapid-public-key`, {
        headers: getAuthHeaders(),
      });
      if (!vapidRes.ok) {
        throw new Error("فشل جلب مفتاح VAPID من الخادم");
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) {
        throw new Error("مفتاح VAPID غير متاح على الخادم");
      }

      // 4. Subscribe via PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Send flat toJSON() to server (no wrapping)
      const subJson = subscription.toJSON();
      const saveRes = await fetch(`${API_ORIGIN}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(subJson),
      });
      if (!saveRes.ok) {
        const body = await saveRes.text().catch(() => "");
        throw new Error(`فشل حفظ الاشتراك في الخادم (${saveRes.status}): ${body}`);
      }

      setIsSubscribed(true);
      console.log("[push] subscribed successfully ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء تفعيل الإشعارات";
      console.error("[push] subscribe failed:", err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Unsubscribe in the browser
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
      }

      // Remove from server
      await fetch(`${API_ORIGIN}/api/push/subscribe`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      setIsSubscribed(false);
      console.log("[push] unsubscribed successfully ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء إيقاف الإشعارات";
      console.error("[push] unsubscribe failed:", err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
