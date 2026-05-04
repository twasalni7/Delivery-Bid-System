import { useState, type FC } from "react";
import { Bell, Loader2 } from "lucide-react";
import { subscribeToPush } from "@/lib/push-notifications";

interface PushPermissionPromptProps {
  /** Current user's role — forwarded to subscribeToPush to register the correct DB table */
  role?: string;
  /** Called after the user successfully grants push permission */
  onEnabled: () => void;
  /** Called when the user taps "لاحقاً" or permission is denied */
  onDismiss: () => void;
}

/**
 * PushPermissionPrompt
 *
 * Soft-ask UI shown before the native browser permission dialog.
 * Explains the value of notifications, then calls:
 *   1. OneSignal.Slidedown.promptPush()  — if the SDK is loaded
 *   2. subscribeToPush(role)             — VAPID fallback (always called
 *                                          after permission is granted so
 *                                          our own server push system is
 *                                          also registered)
 *
 * Smart dismissal: the hook (useInstallAndPushFlow) increments a counter
 * and records a timestamp so we back-off exponentially.
 */
export const PushPermissionPrompt: FC<PushPermissionPromptProps> = ({
  role,
  onEnabled,
  onDismiss,
}) => {
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    try {
      // ── Try OneSignal slidedown first (better UX) ──────────────────────
      const OS = window.OneSignal;
      if (OS?.Slidedown) {
        try {
          await OS.Slidedown.promptPush();
        } catch {
          // Slidedown may throw if already subscribed or blocked — fall through
        }
      } else {
        // ── OneSignal not ready — use native Notification.requestPermission ─
        if ("Notification" in window && Notification.permission === "default") {
          await Notification.requestPermission();
        }
      }

      // ── Always wire up our own VAPID push subscription ─────────────────
      // subscribeToPush checks permission internally; if it was just granted
      // above this will complete the subscription; if already granted it's a no-op.
      await subscribeToPush(role);

      if ("Notification" in window && Notification.permission === "granted") {
        onEnabled();
      } else {
        // User denied or dismissed the browser prompt
        onDismiss();
      }
    } catch {
      // Unexpected error — treat as dismiss so we don't block the UI
      onDismiss();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[8900] flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="تفعيل الإشعارات"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-12 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--border)" }}
          />
        </div>

        <div className="px-5 pt-3 pb-2">
          {/* Bell icon */}
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: "var(--brand-subtle)",
                border: "1px solid var(--brand-border)",
              }}
            >
              <Bell size={32} style={{ color: "var(--brand)" }} />
            </div>
          </div>

          {/* Title + subtitle */}
          <h2
            className="text-xl font-black text-center mb-1.5"
            style={{ color: "var(--text)" }}
          >
            فعّل الإشعارات 🔔
          </h2>
          <p
            className="text-sm text-center mb-5 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            ابقَ على اطلاع فوري بطلباتك وعروض السائقين ورسائل التطبيق
          </p>

          {/* Benefits list */}
          <div className="space-y-3 mb-6">
            {benefits.map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <span className="text-xl shrink-0">{b.icon}</span>
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  {b.text}
                </p>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleEnable}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-fg)",
              border: "none",
              boxShadow: loading ? "none" : "0 2px 8px rgba(200,16,46,0.25)",
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Bell size={18} />
            )}
            {loading ? "جارٍ التفعيل..." : "تفعيل الإشعارات الآن"}
          </button>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            disabled={loading}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Static data ─────────────────────────────────────────────────────────────

const benefits = [
  { icon: "📦", text: "إشعار فوري عند قبول أو تحديث طلبك" },
  { icon: "🚗", text: "تنبيه عند اختيار السائق أو انطلاق الرحلة" },
  { icon: "💬", text: "رسائل جديدة من السائق أو العميل" },
] as const;
