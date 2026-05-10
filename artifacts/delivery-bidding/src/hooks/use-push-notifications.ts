import { useEffect, useState } from "react";
import { subscribeToPush, type PushSubscribeResult } from "@/lib/push-notifications";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN } from "@/lib/api-config";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";

/**
 * usePushNotifications
 *
 * ✅ الإصلاح: يتحقق من الـ backend أيضاً وليس فقط من localStorage
 * هذا يحل مشكلة "الزر لا يظهر مرة ثانية" بعد انتهاء صلاحية الـ subscription
 */
export function usePushNotifications(role?: string) {
  const [showNotificationButton, setShowNotificationButton] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastError, setLastError] = useState<PushSubscribeResult | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!("Notification" in window)) {
        setIsChecking(false);
        return;
      }

      const permission = Notification.permission;

      // إذا المستخدم رفض الإشعارات من إعدادات المتصفح — لا داعي للزر
      if (permission === "denied") {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      const isSubscribedLocal = localStorage.getItem(PUSH_SUBSCRIBED_KEY);

      if (permission === "granted" && isSubscribedLocal === "1") {
        // تحقق من أن الـ subscription في المتصفح لا تزال صالحة
        if ("serviceWorker" in navigator && "PushManager" in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            if (!existing) {
              // ✅ الـ subscription انتهت — أعد تعيين الكاش وأظهر الزر
              localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
              setShowNotificationButton(true);
              setIsChecking(false);
              return;
            }
            // ✅ الـ subscription موجودة في المتصفح — تأكد إنها مسجلة في السيرفر
            // هذا يصلح حالة: المستخدم عنده subscription في المتصفح لكنها حُذفت من DB
            try {
              const res = await fetch(`${API_ORIGIN}/api/push/status`, {
                headers: getAuthHeaders(),
              });
              if (res.ok) {
                const data = await res.json() as { hasSubscription?: boolean };
                if (!data.hasSubscription) {
                  // السيرفر ما عنده subscription — أعد التسجيل بصمت
                  void subscribeToPush(role);
                }
              }
            } catch {
              // السيرفر غير متاح — نتجاهل ونكمل
            }
          } catch {
            // Cannot verify — optimistically hide the button
          }
        }
        setShowNotificationButton(false);
      } else {
        // permission === "default" أو ما في كاش — أظهر الزر
        setShowNotificationButton(true);
      }
      setIsChecking(false);
    };
    void checkSubscription();
  }, [role]);

  const subscribeUserToPush = async (): Promise<PushSubscribeResult> => {
    setLastError(null);
    const result = await subscribeToPush(role);
    if (result === "ok" || result === "already_subscribed") {
      setShowNotificationButton(false);
    } else {
      setLastError(result);
    }
    return result;
  };

  return { showNotificationButton, isChecking, lastError, subscribeUserToPush };
}
