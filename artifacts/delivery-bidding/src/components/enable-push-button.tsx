import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { subscribeToPush } from "@/lib/push-notifications";
import { useAuth } from "@/contexts/auth-context";

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
  const [permission, setPermission] = useState<PermissionState>("default");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    if (
      Notification.permission === "granted" &&
      localStorage.getItem("push_subscribed") === "1"
    ) {
      setDone(true);
    }
  }, []);

  if (permission === "unsupported") return null;

  async function handleEnable() {
    setLoading(true);
    try {
      await subscribeToPush(user?.role);
      setPermission(Notification.permission as PermissionState);
      if (Notification.permission === "granted") setDone(true);
    } finally {
      setLoading(false);
    }
  }

  // Already subscribed
  if (done || (permission === "granted" && localStorage.getItem("push_subscribed") === "1")) {
    return (
      <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-emerald-700">
        <BellRing size={16} className="shrink-0 text-emerald-600" />
        <p className="text-sm font-bold">الإشعارات الفورية مفعّلة ✓</p>
      </div>
    );
  }

  // Denied by user
  if (permission === "denied") {
    return (
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
        <BellOff size={16} className="shrink-0 text-amber-600 mt-0.5" />
        <p className="text-sm font-bold leading-relaxed">
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
      className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-black text-sm rounded-2xl px-4 py-3 transition-colors shadow-md shadow-indigo-900/20"
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Bell size={16} />
      )}
      {loading ? "جارٍ التفعيل..." : "تفعيل الإشعارات الفورية"}
    </button>
  );
}
