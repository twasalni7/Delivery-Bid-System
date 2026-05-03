import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/push-notifications";

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
  const [showNotificationButton, setShowNotificationButton] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!("Notification" in window)) return;
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
              return; // showNotificationButton stays true
            }
          } catch {
            // Cannot verify — optimistically hide the button
          }
        }
        setShowNotificationButton(false);
      }
    };
    void checkSubscription();
  }, []);

  const subscribeUserToPush = async () => {
    await subscribeToPush(role);
    if (Notification.permission === "granted") {
      localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
      setShowNotificationButton(false);
    }
  };

  return { showNotificationButton, subscribeUserToPush };
}
