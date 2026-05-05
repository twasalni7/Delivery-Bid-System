import { useEffect, useState } from "react";
import { subscribeToPush, type PushSubscribeResult } from "@/lib/push-notifications";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";

/**
 * usePushNotifications
 *
 * Hook يتحقق من إذن الإشعارات وحالة الاشتراك، ويوفر دالة لتفعيل
 * إشعارات الدفع للمستخدم الحالي.
 *
 * يتحقق أيضاً من أن الاشتراك المخزن لا يزال صالحاً في المتصفح؛
 * إذا انتهت صلاحيته يُعاد تعيين الكاش ويظهر الزر مجدداً.
 *
 * @param role - دور المستخدم ("driver" | "client" | "admin") لتوجيه الاشتراك للجدول الصحيح.
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
      const isSubscribedLocal = localStorage.getItem(PUSH_SUBSCRIBED_KEY);

      if (permission === "granted" && isSubscribedLocal === "1") {
        // Verify the browser-side subscription is still active.
        // If the user cleared site data or the subscription expired, the cache
        // will be stale — clear it so the enable button reappears.
        if ("serviceWorker" in navigator && "PushManager" in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            if (!existing) {
              localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
              setShowNotificationButton(true);
              setIsChecking(false);
              return;
            }
          } catch {
            // Cannot verify — optimistically hide the button
          }
        }
        setShowNotificationButton(false);
      } else {
        setShowNotificationButton(true);
      }
      setIsChecking(false);
    };
    void checkSubscription();
  }, []);

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
