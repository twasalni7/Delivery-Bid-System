import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { AdminPageTabs } from "@/components/admin-page-tabs";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN as API } from "@/lib/api-config";
import { RefreshCw, BellRing, ServerCrash, Smartphone, ShieldCheck, AlertTriangle } from "lucide-react";

type DebugDevice = {
  role: "client" | "driver" | "admin";
  userId: number;
  endpoint: string | null;
};

type DebugData = {
  provider?: "onesignal" | "vapid" | "none";
  oneSignalConfigured?: boolean;
  oneSignalAppId?: string | null;
  vapidConfigured: boolean;
  vapidPublicKey: string | null;
  subscriptions: {
    clients: number;
    drivers: number;
    admins: number;
    total: number;
  };
  devices: DebugDevice[];
};

type SelfCheckData = {
  provider: "onesignal" | "vapid" | "none";
  user: { id: number; role: "client" | "driver" | "admin"; externalId: string };
  server: { oneSignalConfigured: boolean; vapidConfigured: boolean };
  legacyDb: { hasSubscription: boolean | null };
  oneSignal: null | {
    ok: boolean;
    status: number | null;
    summary: null | { oneSignalUserId: string | null; subscriptionCount: number | null };
  };
};

type SwStatus = "not_supported" | "checking" | "registered" | "not_registered" | "error";

function swStatusLabel(s: SwStatus): string {
  switch (s) {
    case "not_supported": return "غير مدعوم في هذا المتصفح";
    case "checking": return "جارٍ الفحص…";
    case "registered": return "مسجّل ✓";
    case "not_registered": return "غير مسجّل";
    case "error": return "خطأ في الفحص";
    default: return s;
  }
}

function swStatusColor(s: SwStatus): string {
  switch (s) {
    case "registered": return "var(--status-active-text)";
    case "not_registered":
    case "error": return "var(--status-cancelled-text)";
    default: return "var(--text-muted)";
  }
}

const ROLE_LABEL: Record<string, string> = {
  client: "عميل",
  driver: "سائق",
  admin: "مشرف",
};

export default function AdminPushDebug() {
  const [data, setData] = useState<DebugData | null>(null);
  const [selfCheck, setSelfCheck] = useState<SelfCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<SwStatus>("checking");

  const fetchDebug = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/push/debug`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json() as DebugData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchSelfCheck = async () => {
    try {
      const res = await fetch(`${API}/api/push/self-check`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      setSelfCheck(await res.json() as SelfCheckData);
    } catch {
      // optional diagnostics only
    }
  };

  const checkServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
      setSwStatus("not_supported");
      return;
    }
    setSwStatus("checking");
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      setSwStatus(regs.length > 0 ? "registered" : "not_registered");
    } catch {
      setSwStatus("error");
    }
  };

  useEffect(() => {
    void fetchDebug();
    void fetchSelfCheck();
    void checkServiceWorker();
  }, []);

  return (
    <Layout role="admin">
      <div className="max-w-2xl mx-auto space-y-5 pb-10">
        <AdminPageTabs
          tabs={[
            { href: "/admin/notifications", label: "إرسال الإشعارات" },
            { href: "/admin/notifications-monitor", label: "مراقبة الإشعارات" },
            { href: "/admin/push-debug", label: "تشخيص Push" },
          ]}
        />
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            تشخيص نظام الإشعارات الفورية
          </h1>
          <button
            onClick={() => { void fetchDebug(); void fetchSelfCheck(); void checkServiceWorker(); }}
            disabled={loading}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg btn-ghost disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--status-cancelled-bg)",
              border: "1px solid var(--status-cancelled-border)",
              color: "var(--status-cancelled-text)",
            }}
          >
            <ServerCrash size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Self-check (server + current account mapping) */}
        {selfCheck && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              فحص سريع (هذا الحساب)
            </h2>

            <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <p>
                المزوّد الفعّال:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {selfCheck.provider === "onesignal"
                    ? "OneSignal"
                    : selfCheck.provider === "vapid"
                      ? "VAPID"
                      : "غير مهيّأ"}
                </strong>
              </p>
              <p>
                External ID:{" "}
                <span className="font-mono" style={{ color: "var(--text)" }}>
                  {selfCheck.user.externalId}
                </span>
              </p>
            </div>

            {selfCheck.provider === "onesignal" && selfCheck.oneSignal && (
              <div
                className="rounded-xl px-4 py-3 space-y-1"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  OneSignal lookup:{" "}
                  <strong style={{ color: selfCheck.oneSignal.ok ? "var(--status-active-text)" : "var(--status-cancelled-text)" }}>
                    {selfCheck.oneSignal.ok ? "نجح ✓" : "فشل"}
                  </strong>
                  {selfCheck.oneSignal.status != null && (
                    <span className="font-mono"> (HTTP {selfCheck.oneSignal.status})</span>
                  )}
                </p>
                {selfCheck.oneSignal.summary && (
                  <p className="text-xs font-mono break-all" style={{ color: "var(--text-muted)" }}>
                    userId={selfCheck.oneSignal.summary.oneSignalUserId ?? "—"} subscriptions={selfCheck.oneSignal.summary.subscriptionCount ?? "—"}
                  </p>
                )}
                {!selfCheck.oneSignal.ok && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    غالباً السبب: external_id غير مسجّل في OneSignal أو REST API Key غير صحيح/صلاحياته ناقصة.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              اشتراك قاعدة البيانات (للـVAPID فقط):{" "}
              <strong style={{ color: "var(--text)" }}>
                {selfCheck.legacyDb.hasSubscription === null
                  ? "غير معروف"
                  : selfCheck.legacyDb.hasSubscription
                    ? "موجود"
                    : "غير موجود"}
              </strong>
            </p>
          </div>
        )}

        {/* Service Worker status (client-side check) */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            حالة Service Worker (هذا الجهاز)
          </h2>
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: swStatusColor(swStatus) }}
            />
            <span className="text-sm font-medium" style={{ color: swStatusColor(swStatus) }}>
              {swStatusLabel(swStatus)}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>إذن الإشعارات:</span>
            <span
              className="text-sm font-medium"
              style={{
                color:
                  "Notification" in window && Notification.permission === "granted"
                    ? "var(--status-active-text)"
                    : "var(--status-cancelled-text)",
              }}
            >
              {"Notification" in window ? Notification.permission : "غير مدعوم"}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>بروتوكول الصفحة:</span>
            <span
              className="text-sm font-medium"
              style={{
                color:
                  location.protocol === "https:" || location.hostname === "localhost"
                    ? "var(--status-active-text)"
                    : "var(--status-cancelled-text)",
              }}
            >
              {location.protocol}
              {location.protocol !== "https:" && location.hostname !== "localhost" && (
                <span> ⚠ Push يتطلب HTTPS</span>
              )}
            </span>
          </div>
        </div>

        {/* Provider status */}
        {data && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              حالة مزود الإشعارات (الخادم)
            </h2>
            <div className="flex items-center gap-2.5">
              <ShieldCheck
                size={16}
                className="shrink-0"
                style={{
                  color: data.oneSignalConfigured || data.vapidConfigured
                    ? "var(--status-active-text)"
                    : "var(--status-cancelled-text)",
                }}
              />
              <span
                className="text-sm font-medium"
                style={{
                  color: data.oneSignalConfigured || data.vapidConfigured
                    ? "var(--status-active-text)"
                    : "var(--status-cancelled-text)",
                }}
              >
                {data.provider === "onesignal"
                  ? "OneSignal مُهيَّأ ✓"
                  : data.vapidConfigured
                    ? "VAPID مُهيَّأ ✓"
                    : "لا يوجد مزود إشعارات مُهيَّأ"}
              </span>
            </div>
            {data.oneSignalAppId && (
              <p
                className="text-xs font-mono break-all rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                OneSignal App ID: {data.oneSignalAppId}
              </p>
            )}
            {!data.oneSignalAppId && data.vapidPublicKey && (
              <p
                className="text-xs font-mono break-all rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                VAPID: {data.vapidPublicKey.slice(0, 40)}…
              </p>
            )}
          </div>
        )}

        {/* Subscription counts */}
        {data && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              عدد الاشتراكات المخزنة محلياً (VAPID فقط)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { label: "عملاء", value: data.subscriptions.clients },
                  { label: "سائقون", value: data.subscriptions.drivers },
                  { label: "مشرفون", value: data.subscriptions.admins },
                  { label: "الإجمالي", value: data.subscriptions.total },
                ] as { label: string; value: number }[]
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl px-4 py-3 text-center"
                  style={{ backgroundColor: "var(--surface-2)" }}
                >
                  <p className="text-xl font-bold" style={{ color: "var(--brand)" }}>
                    {value}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected devices */}
        {data && data.devices.length > 0 && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              الأجهزة المتصلة (آخر 10 لكل دور)
            </h2>
            <ul className="space-y-2">
              {data.devices.map((d, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Smartphone size={14} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                  <div className="min-w-0">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--brand)" }}
                    >
                      {ROLE_LABEL[d.role] ?? d.role} #{d.userId}
                    </span>
                    <p
                      className="text-xs font-mono break-all mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {d.endpoint ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && data.devices.length === 0 && !loading && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--status-open-bg)",
              border: "1px solid var(--status-open-border)",
              color: "var(--status-open-text)",
            }}
          >
            <AlertTriangle size={16} className="shrink-0" />
            لا توجد اشتراكات مسجّلة في قاعدة البيانات حتى الآن.
          </div>
        )}

        {/* How-to guide */}
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <BellRing size={15} />
            دليل فحص الأعطال
          </h2>
          <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <li>١. تحقق أن Service Worker في حالة «مسجّل» أعلاه.</li>
            <li>٢. تحقق أن إذن الإشعارات = <strong>granted</strong>.</li>
            <li>٣. تحقق أن الصفحة تعمل عبر <strong>HTTPS</strong> أو localhost.</li>
            <li>٤. إذا المزوّد = OneSignal: تأكد من تفعيل ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY على الخادم.</li>
            <li>٥. إذا المزوّد = VAPID: تأكد من VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY، وتوقع زيادة «الاشتراكات المخزنة» بمقدار 1 بعد التفعيل.</li>
            <li>٦. افتح Console المتصفح وابحث عن رسائل <code>[Push]</code> لتتبع كل مرحلة.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
