import { Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * PushNotificationPrompt
 *
 * زر بسيط لتفعيل أو إيقاف إشعارات الدفع.
 * يستخدم usePushNotifications لإدارة الحالة ويعرض رسالة خطأ عند الفشل.
 * RTL Arabic — يستخدم متغيرات CSS الموجودة.
 */
export function PushNotificationPrompt() {
  const { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <div dir="rtl">
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
        style={{
          backgroundColor: isSubscribed ? "var(--surface-2)" : "var(--brand-subtle)",
          border: `1px solid ${isSubscribed ? "var(--border)" : "var(--brand-border)"}`,
          color: isSubscribed ? "var(--text-muted)" : "var(--brand)",
        }}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isSubscribed ? (
          "🔕 إيقاف الإشعارات"
        ) : (
          "🔔 فعّل الإشعارات"
        )}
      </button>

      {error && (
        <p className="mt-1 text-xs text-center" style={{ color: "var(--status-cancelled-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
 
