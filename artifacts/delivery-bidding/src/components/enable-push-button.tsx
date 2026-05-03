import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePushNotifications } from "@/hooks/use-push-notifications";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * EnablePushButton
 *
 * زر يتيح لجميع فئات المستخدمين (سائق / عميل / إداري) تفعيل إشعارات الدفع.
 * يستخرج دور المستخدم تلقائياً من سياق المصادقة ويرسله إلى الخادم ليُحدَّث
 * الجدول الصحيح (drivers / clients / admins).
 *
 * الحالات المعروضة:
 * - مفعّل بالفعل  → شارة خضراء "الإشعارات الفورية مفعّلة ✓"
 * - مرفوض         → تنبيه أصفر بتعليمات إعادة التفعيل من إعدادات المتصفح
 * - لم يُختر بعد  → زر أزرق "تفعيل الإشعارات الفورية"
 */
export function EnablePushButton() {
  const { user } = useAuth();
  const { showNotificationButton, subscribeUserToPush } = usePushNotifications(user?.role);
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

  if (permission === "unsupported") return null;

  async function handleEnable() {
    setLoading(true);
    try {
      await subscribeUserToPush();
      setPermission(Notification.permission as PermissionState);
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

  // Denied by user
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

  // Default — show enable button
  return (
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
      {loading ? "جارٍ التفعيل..." : "تفعيل الإشعارات الفورية"}
    </button>
  );
}
