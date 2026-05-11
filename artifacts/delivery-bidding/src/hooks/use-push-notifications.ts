/**
 * use-push-notifications.ts — OneSignal Hook (PR #136 Fix)
 *
 * الإصلاح: يوحّد واجهة الـ hook مع ما يتوقعه EnablePushButton
 * يرجع:
 *   - showNotificationButton: هل تظهر زر التفعيل
 *   - isChecking: جاري الفحص
 *   - lastError: آخر خطأ
 *   - subscribeUserToPush: دالة التفعيل
 */
import { useEffect, useState, useCallback } from "react";
import {
  initOneSignal,
  loginOneSignal,
  requestPushPermission,
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
    // تهيئة OneSignal دائماً
    initOneSignal().catch(console.warn);
  }, []);

  useEffect(() => {
    // ربط المستخدم بـ OneSignal عند الدخول
    if (user?.id && user?.role) {
      loginOneSignal(user.id as number, user.role).catch(console.warn);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    const check = async () => {
      setIsChecking(true);

      // لا يدعم الإشعارات
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      const perm = Notification.permission;

      // مرفوض من المستخدم
      if (perm === "denied") {
        setShowNotificationButton(false);
        setIsChecking(false);
        return;
      }

      // ممنوح — تحقق من OneSignal subscription
      if (perm === "granted") {
        try {
          await initOneSignal();
          const os = window.OneSignal;

          // انتظر قليلاً حتى يتم ربط المستخدم بـ OneSignal
          // loginOneSignal يُستدعى في App.tsx useEffect
          await new Promise(resolve => setTimeout(resolve, 1000));

          if (os?.User?.PushSubscription?.optedIn && os?.User?.PushSubscription?.token) {
            // مشترك بالفعل
            setShowNotificationButton(false);
            setIsChecking(false);
            return;
          }
        } catch {
          // لا نتوقف
        }
        // الإذن ممنوح لكن OneSignal غير مسجّل — أظهر الزر
        setShowNotificationButton(true);
        setIsChecking(false);
        return;
      }

      // default — أظهر زر التفعيل
      setShowNotificationButton(true);
      setIsChecking(false);
    };

    void check();
  }, [user?.id]);

  const subscribeUserToPush = useCallback(async (): Promise<PushSubscribeResult> => {
    setLastError(null);

    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "permission_denied";

    try {
      await initOneSignal();
      const os = window.OneSignal;
      if (!os) return "server_error";

      // طلب الإذن
      if (!os.Notifications.permission) {
        await os.Notifications.requestPermission();
      }

      if (Notification.permission !== "granted") {
        const result: PushSubscribeResult = "permission_default";
        setLastError(result);
        return result;
      }

      // ربط المستخدم
      if (user?.id && user?.role) {
        const externalId = `${user.role}:${user.id}`;
        await os.login(externalId);
        try {
          os.User.addTags({ role: user.role ?? role ?? "unknown", userId: String(user.id) });
        } catch {
          // اختيارية
        }
      }

      // Opt-in
      if (!os.User.PushSubscription.optedIn) {
        await os.User.PushSubscription.optIn();
      }

      // انتظر قليلاً حتى يتم تأكيد التسجيل
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowNotificationButton(false);
      return os.User.PushSubscription.token ? "ok" : "already_subscribed";
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
