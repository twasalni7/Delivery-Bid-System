import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { Bell, RefreshCw, CheckCircle, XCircle, Smartphone } from "lucide-react";

interface NotifMonitor {
  totalNotifications: number;
  totalSubscriptions: number;
  recentNotifications: Array<{
    id: number;
    title: string;
    message: string;
    createdAt: string;
  }>;
  pushStatus: "configured" | "not_configured";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default function AdminNotificationsMonitor() {
  const [data, setData] = useState<NotifMonitor | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/notifications-monitor`, { headers: getAuthHeaders() });
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Layout role="admin">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>مراقبة الإشعارات</h1>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
            جاري التحميل...
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: <Bell size={20} />, label: "إجمالي الإشعارات", value: data?.totalNotifications ?? 0 },
                { icon: <Smartphone size={20} />, label: "الأجهزة المشتركة", value: data?.totalSubscriptions ?? 0 },
                {
                  icon: data?.pushStatus === "configured" ? <CheckCircle size={20} /> : <XCircle size={20} />,
                  label: "حالة Push",
                  value: data?.pushStatus === "configured" ? "مفعّل" : "غير مفعّل",
                },
              ].map((card, i) => (
                <div key={i} className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    {card.icon}
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{card.value}</div>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* VAPID keys status */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: data?.pushStatus === "configured" ? "var(--status-active-text)" : "var(--status-cancelled-text)" }}
                />
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                    {data?.pushStatus === "configured" ? "مفاتيح VAPID مضبوطة ✓" : "مفاتيح VAPID غير مضبوطة"}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {data?.pushStatus === "configured"
                      ? "الإشعارات الفورية تعمل بشكل صحيح"
                      : "يرجى إضافة VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY"}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent notifications */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4" style={{ color: "var(--text)" }}>آخر الإشعارات</h2>
              {(data?.recentNotifications ?? []).length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد إشعارات حديثة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(data?.recentNotifications ?? []).map(n => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                        <Bell size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{n.title}</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{n.message}</div>
                      </div>
                      <div className="text-xs shrink-0" style={{ color: "var(--text-hint)" }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
