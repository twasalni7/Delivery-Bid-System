import { usePushNotifications } from "@/hooks/use-push-notifications";

export function PushNotificationPrompt({ role }: { role?: string }) {
  const { showNotificationButton, isChecking, lastError, subscribeUserToPush } = usePushNotifications(role);

  if (isChecking || !showNotificationButton) return null;

  return (
    <div dir="rtl">
      <button
        onClick={subscribeUserToPush}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={{
          backgroundColor: "var(--brand-subtle)",
          border: "1px solid var(--brand-border)",
          color: "var(--brand)",
        }}
      >
        <span>🔔 فعّل الإشعارات</span>
      </button>

      {lastError && (
        <p className="mt-1 text-xs text-center" style={{ color: "var(--status-cancelled-text)" }}>
          {lastError}
        </p>
      )}
    </div>
  );
}
