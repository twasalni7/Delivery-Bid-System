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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<SwStatus>("checking");
  const [diagLog, setDiagLog] = useState<string[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);

  const addLog = (msg: string) => {
    setDiagLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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

  const testBackendConnection = async () => {
    setDiagLog([]);
    setDiagLoading(true);
    addLog("اختبار اتصال بالباكند...");

    try {
      addLog("إرسال GET /api/push/my-subscription...");
      const res = await fetch(`${API}/api/push/my-subscription`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      addLog(`الاستجابة: ${res.status} ${res.statusText}`);

      if (res.ok) {
        const body = await res.json();
        addLog(`البيانات: ${JSON.stringify(body, null, 2)}`);
      } else {
        const errText = await res.text();
        addLog(`خطأ: ${errText}`);
      }
    } catch (err) {
      addLog(`استثناء: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiagLoading(false);
    }
  };

  const testDetailedSubscription = async () => {
    setDiagLog([]);
    setDiagLoading(true);
    addLog("بدء اختبار الاشتراك المفصّل...");

    try {
      // Step 1: Check permission
      addLog("1️⃣ فحص إذن الإشعارات...");
      if (!("Notification" in window)) {
        addLog("❌ المتصفح لا يدعم الإشعارات");
        setDiagLoading(false);
        return;
      }
      addLog(`الإذن الحالي: ${Notification.permission}`);

      if (Notification.permission !== "granted") {
        addLog("طلب الإذن من المستخدم...");
        const perm = await Notification.requestPermission();
        addLog(`الإذن بعد الطلب: ${perm}`);
        if (perm !== "granted") {
          addLog("❌ المستخدم رفض الإذن");
          setDiagLoading(false);
          return;
        }
      }
      addLog("✓ الإذن ممنوح");

      // Check Service Worker support
      if (!("serviceWorker" in navigator)) {
        addLog("❌ Service Worker غير مدعوم في هذا المتصفح");
        setDiagLoading(false);
        return;
      }

      // Step 2: Register Service Worker
      addLog("2️⃣ تسجيل Service Worker...");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      addLog("✓ Service Worker مسجّل");

      // Step 3: Get VAPID key
      addLog("3️⃣ جلب VAPID public key...");
      const vapidRes = await fetch(`${API}/api/push/vapid-public-key`);
      if (!vapidRes.ok) {
        addLog(`❌ فشل جلب VAPID key: ${vapidRes.status}`);
        setDiagLoading(false);
        return;
      }
      const vapidData = await vapidRes.json() as { publicKey: string };
      if (!vapidData.publicKey || vapidData.publicKey.trim().length === 0) {
        addLog("❌ VAPID key فارغ أو غير موجود");
        setDiagLoading(false);
        return;
      }
      addLog(`✓ VAPID key: ${vapidData.publicKey.substring(0, 30)}...`);

      // Step 4: Subscribe
      addLog("4️⃣ إنشاء اشتراك Push...");
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
      });
      addLog("✓ اشتراك محلي تم إنشاؤه");

      // Step 5: Send to backend
      addLog("5️⃣ إرسال الاشتراك للباكند...");
      const subJSON = subscription.toJSON();
      addLog(`Endpoint: ${subJSON.endpoint?.substring(0, 50)}...`);

      const saveRes = await fetch(`${API}/api/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ subscription: subJSON }),
      });

      addLog(`استجابة الباكند: ${saveRes.status} ${saveRes.statusText}`);

      if (saveRes.ok) {
        const saveData = await saveRes.json();
        addLog(`✓ تم الحفظ بنجاح: ${JSON.stringify(saveData)}`);
      } else {
        const errData = await saveRes.text();
        addLog(`❌ فشل الحفظ: ${errData}`);
      }

      // Step 6: Verify
      addLog("6️⃣ التحقق من الحفظ...");
      const verifyRes = await fetch(`${API}/api/push/my-subscription`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        addLog(`✓ التحقق: ${JSON.stringify(verifyData, null, 2)}`);
      }

    } catch (err) {
      addLog(`❌ خطأ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiagLoading(false);
    }
  };

  // Helper function (same as in push-notifications.ts)
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  useEffect(() => {
    void fetchDebug();
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
            onClick={() => { void fetchDebug(); void checkServiceWorker(); }}
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
              عدد الاشتراكات المخزنة محلياً
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

        {/* Diagnostic Tools */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            أدوات التشخيص المتقدمة
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => void testBackendConnection()}
              disabled={diagLoading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor: "var(--brand)",
                color: "var(--brand-fg)",
              }}
            >
              اختبر الاتصال بالباكند
            </button>
            <button
              onClick={() => void testDetailedSubscription()}
              disabled={diagLoading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor: "var(--status-active-bg)",
                color: "var(--status-active-text)",
                border: "1px solid var(--status-active-border)",
              }}
            >
              محاولة اشتراك مع عرض تفصيلي
            </button>
          </div>
          {diagLog.length > 0 && (
            <div
              className="rounded-lg p-3 mt-3 space-y-1 text-xs font-mono max-h-80 overflow-y-auto"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            >
              {diagLog.map((log, i) => (
                <div key={i} style={{ color: "var(--text-muted)" }}>{log}</div>
              ))}
            </div>
          )}
        </div>

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
            <li>٤. تحقق أن VAPID مُهيَّأ على الخادم (متغيرات البيئة VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).</li>
            <li>٥. بعد تفعيل الإشعارات، يجب أن يرتفع عدد الاشتراكات بمقدار 1.</li>
            <li>٦. افتح Console المتصفح وابحث عن رسائل <code>[Push]</code> لتتبع كل مرحلة.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
