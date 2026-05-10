import { useEffect, useState } from "react";
import {
  isPushEnabled,
  subscribeToPush,
  type PushSubscribeResult,
} from "@/lib/push-notifications";

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

      if (permission === "granted") {
        const enabled = await isPushEnabled();
        setShowNotificationButton(!enabled);
      } else {
        setShowNotificationButton(true);
      }
      setIsChecking(false);
    };

    const handleStatusChange = () => {
      void checkSubscription();
    };

    void checkSubscription();
    window.addEventListener("push-status-changed", handleStatusChange);
    return () => window.removeEventListener("push-status-changed", handleStatusChange);
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
