import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import type { PushSubscribeResult } from "@/lib/push-notifications";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

function errorMessage(reason: PushSubscribeResult): string {
  switch (reason) {
    case "permission_denied":
      return "الإشعارات محجوبة. افتح إعدادات المتصفح وأعِد السماح لهذا الموقع.";
    case "permission_default":
      return "لم يتم منح الإذن. اضغط على الزر مرة أخرى وامنح الإذن عند ظهور النافذة.";
    case "no_vapid_key":
      return "خدمة الإشعارات غير مُهيَّأة على الخادم. تواصل مع الدعم.";
    case "sw_error":
      return "تعذّر تسجيل Service Worker. أعِد تحميل الصفحة وحاول مرة أخرى.";
    case "subscribe_error":
      return "فشل إنشاء الاشتراك. تأكد من أن الصفحة تعمل عبر HTTPS وأعِد المحاولة.";
    case "server_error":
      return "تم تفعيل الإشعارات في المتصفح لكن فشل الحفظ في الخادم. يُرجى المحاولة مرة أخرى أو التواصل مع الدعم إذا استمر الخطأ.";
    default:
      return "حدث خطأ غير متوقع. أعِد المحاولة.";
  }
}

/**
 * EnablePushButton
 *
 * زر يتيح لجميع فئات المستخدمين (سائق / عميل / إداري) تفعيل إشعارات الدفع.
 * يستخرج دور المستخدم تلقائياً من سياق المصادقة ويرسله إلى الخادم ليُحدَّث
 * الجدول الصحيح (drivers / clients / admins).
 *
 * الحالات المعروضة:
 * - جاري الفحص       → لا شيء (مؤقت حتى تنتهي checkSubscription)
 * - مفعّل بالفعل  → شارة خضراء "الإشعارات الفورية مفعّلة ✓"
 * - مرفوض         → تنبيه أصفر بتعليمات إعادة التفعيل من إعدادات المتصفح
 * - فشل التفعيل   → رسالة خطأ واضحة
 * - لم يُختر بعد  → زر أزرق "تفعيل الإشعارات الفورية"
 */
export function EnablePushButton() {
  const { user } = useAuth();
  const { showNotificationButton, isChecking, lastError, subscribeUserToPush } = usePushNotifications(user?.role);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  // Wait for initial subscription check to avoid flash
  if (isChecking) return null;
  if (permission === "unsupported") return null;

  async function handleEnable() {
    setLoading(true);
    try {
      const result = await subscribeUserToPush();
      setPermission(Notification.permission as PermissionState);
      // If we got a definitive denial from the browser, update local state immediately
      if (result === "permission_denied") {
        setPermission("denied");
      }
    } finally {
      setLoading(false);
    }
  }

  // Already subscribed
  if (!showNotificationButton) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
        style={{ backgroundColor: "var(--status-active-bg)", border: "1px solid var(--status-active-border)", color: "var(--status-active-text)" }}>
        <BellRing size={16} className="shrink-0" />
        <p className="text-sm font-semibold">الإشعارات الفورية مفعّلة ✓</p>
      </div>
    );
  }

  // Denied by user (browser setting)
  if (permission === "denied") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ backgroundColor: "var(--status-open-bg)", border: "1px solid var(--status-open-border)", color: "var(--status-open-text)" }}>
        <BellOff size={16} className="shrink-0 mt-0.5" />
        <p className="text-sm font-semibold leading-relaxed">
          الإشعارات محجوبة. افتح إعدادات المتصفح ← الإشعارات وأعِد السماح لهذا الموقع.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Error feedback from last failed attempt */}
      {lastError && lastError !== "permission_denied" && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{
            backgroundColor: "var(--status-cancelled-bg)",
            border: "1px solid var(--status-cancelled-border)",
            color: "var(--status-cancelled-text)",
          }}
        >
          <BellOff size={14} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage(lastError)}</span>
        </div>
      )}

      {/* Enable button */}
      <button
        onClick={handleEnable}
        disabled={loading}
        className="w-full btn-ghost flex items-center justify-center gap-2.5 disabled:opacity-60 text-sm"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Bell size={16} style={{ color: "var(--brand)" }} />
        )}
        {loading ? "جارٍ التفعيل..." : lastError ? "إعادة المحاولة" : "تفعيل الإشعارات الفورية"}
      </button>
    </div>
  );
}
