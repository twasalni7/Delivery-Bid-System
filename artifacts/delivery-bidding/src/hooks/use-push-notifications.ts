import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/push-notifications";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";

/**
 * usePushNotifications
 *
 * Hook يتحقق من إذن الإشعارات وحالة الاشتراك، ويوفر دالة لتفعيل
 * إشعارات الدفع للمستخدم الحالي.
 *
 * @param role - دور المستخدم ("driver" | "client" | "admin") لتوجيه الاشتراك للجدول الصحيح.
 */
export function usePushNotifications(role?: string) {
  const [showNotificationButton, setShowNotificationButton] = useState(true);

  useEffect(() => {
    const checkSubscription = () => {
      if (!("Notification" in window)) return;
      const permission = Notification.permission;
      const isSubscribedLocal = localStorage.getItem(PUSH_SUBSCRIBED_KEY);
      if (permission === "granted" && isSubscribedLocal === "1") {
        setShowNotificationButton(false);
      }
    };
    checkSubscription();
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
