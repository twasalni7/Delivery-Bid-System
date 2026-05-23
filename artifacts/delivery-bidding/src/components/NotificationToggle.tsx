import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  subscribeToPush,
  unsubscribeFromPush,
  checkPushSubscriptionStatus
} from "@/lib/push-notifications";
import { useToast } from "@/hooks/use-toast";

/**
 * NotificationToggle
 *
 * مكون زر تبديل (Toggle) لتفعيل وإلغاء تفعيل الإشعارات الفورية
 * يظهر الحالة الحالية ويسمح للمستخدم بالتحكم في الإشعارات
 */
export function NotificationToggle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // فحص الحالة الحالية للإشعارات
  useEffect(() => {
    const checkStatus = async () => {
      setIsLoading(true);
      try {
        const status = await checkPushSubscriptionStatus();
        setPermission(status.permission);
        setIsEnabled(status.subscribed && status.permission === "granted");
      } catch (error) {
        console.error("Failed to check notification status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void checkStatus();
  }, []);

  const handleToggle = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (isEnabled) {
        // إلغاء تفعيل الإشعارات
        await unsubscribeFromPush();
        setIsEnabled(false);
        toast({
          title: "تم إيقاف الإشعارات",
          description: "لن تتلقى إشعارات فورية بعد الآن",
        });
      } else {
        // تفعيل الإشعارات
        const result = await subscribeToPush(user?.role);

        if (result === "ok" || result === "already_subscribed") {
          setIsEnabled(true);
          setPermission("granted");
          toast({
            title: "تم تفعيل الإشعارات",
            description: "ستتلقى إشعارات فورية عند حدوث تحديثات",
          });
        } else if (result === "denied") {
          setPermission("denied");
          toast({
            title: "تم رفض الإذن",
            description: "يرجى السماح بالإشعارات من إعدادات المتصفح",
            variant: "destructive",
          });
        } else {
          toast({
            title: "فشل تفعيل الإشعارات",
            description: "حدث خطأ أثناء تفعيل الإشعارات. حاول مرة أخرى.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error toggling notifications:", error);
      toast({
        title: "حدث خطأ",
        description: "تعذر تغيير إعدادات الإشعارات",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // إذا كان المتصفح لا يدعم الإشعارات
  if (!('Notification' in window)) {
    return (
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)"
        }}
      >
        <div className="flex items-center gap-3">
          <BellOff size={20} style={{ color: "var(--text-muted)" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              الإشعارات الفورية
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              المتصفح لا يدعم الإشعارات
            </p>
          </div>
        </div>
      </div>
    );
  }

  // إذا تم رفض الإذن من إعدادات المتصفح
  if (permission === "denied") {
    return (
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          backgroundColor: "var(--status-open-bg)",
          border: "1px solid var(--status-open-border)"
        }}
      >
        <div className="flex items-center gap-3">
          <BellOff size={20} style={{ color: "var(--status-open-text)" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              الإشعارات الفورية
            </p>
            <p className="text-xs" style={{ color: "var(--status-open-text)" }}>
              محجوبة - قم بتفعيلها من إعدادات المتصفح
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={{
        backgroundColor: "var(--surface-2)",
        border: "1px solid var(--border)"
      }}
    >
      <div className="flex items-center gap-3">
        {isEnabled ? (
          <Bell size={20} style={{ color: "var(--brand)" }} />
        ) : (
          <BellOff size={20} style={{ color: "var(--text-muted)" }} />
        )}
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
            الإشعارات الفورية
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isLoading
              ? "جاري الفحص..."
              : isEnabled
                ? "مفعّلة - ستتلقى إشعارات فورية"
                : "معطّلة - لن تتلقى إشعارات فورية"
            }
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={isLoading || isProcessing}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
        style={{
          backgroundColor: isEnabled ? "var(--brand)" : "var(--border-strong)",
        }}
        aria-label={isEnabled ? "إيقاف الإشعارات" : "تفعيل الإشعارات"}
      >
        {isProcessing ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={12} className="animate-spin" style={{ color: "white" }} />
          </span>
        ) : (
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
            style={{
              transform: isEnabled ? "translateX(-1.25rem)" : "translateX(0.25rem)",
            }}
          />
        )}
      </button>
    </div>
  );
}
