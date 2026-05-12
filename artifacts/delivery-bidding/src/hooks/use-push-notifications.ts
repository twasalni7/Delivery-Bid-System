/**
 * use-push-notifications.ts — Web Push Hook
 *
 * Hook لإدارة الإشعارات عبر Web Push API
 */
import { useEffect, useState, useCallback } from "react";
import {
  initPushNotifications,
  subscribeToPush,
  checkPushSubscriptionStatus,
} from "@/lib/push-notifications";
import { useAuth } from "@/contexts/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────
export type PushSubscribeResult =
  | "ok"
  | "already_subscribed"
  | "permission_denied"
  | "permission_default"
  | "no_vapid_key"
  | "sw_error"
  | "subscribe_error"
  | "server_error"
  | "unsupported"
  | "sdk_unavailable";

// ─── usePushNotifications ─────────────────────────────────────────────────────
export function usePushNotifications(role?: string) {
  const { user } = useAuth();

  const [showNotificationButton, setShowNotificationButton] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastError, setLastError] = useState<PushSubscribeResult | null>(null);

  useEffect(() => {
    // تهيئة Service Worker عند تحميل التطبيق
    initPushNotifications().catch(console.warn);
  }, []);

  useEffect(() => {
    const check = async () => {
      setIsChecking(true);

      const status = await checkPushSubscriptionStatus();

      // لا يدعم الإشعارات
      if (!status.supported) {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      // مرفوض من المستخدم
      if (status.permission === "denied") {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      // مشترك بالفعل
      if (status.subscribed) {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      // غير مشترك — أظهر زر التفعيل
      setShowNotificationButton(true);
      setIsChecking(false);
    };

    void check();
  }, [user?.id]);

  const subscribeUserToPush = useCallback(async (): Promise<PushSubscribeResult> => {
    setLastError(null);

    if (!('Notification' in window)) return "unsupported";
    if (Notification.permission === "denied") return "permission_denied";

    try {
      const result = await subscribeToPush(role ?? user?.role);

      if (result === "ok") {
        setShowNotificationButton(false);
        return "ok";
      }

      if (result === "denied") {
        const mappedResult: PushSubscribeResult = "permission_denied";
        setLastError(mappedResult);
        return mappedResult;
      }

      const mappedResult: PushSubscribeResult = result === "unsupported" ? "unsupported" : "subscribe_error";
      setLastError(mappedResult);
      return mappedResult;
    } catch (err) {
      console.error("[Push] subscribeUserToPush error:", err);
      const result: PushSubscribeResult = "subscribe_error";
      setLastError(result);
      return result;
    }
  }, [user?.id, user?.role, role]);

  return {
    showNotificationButton,
    isChecking,
    lastError,
    subscribeUserToPush,
  };
}
