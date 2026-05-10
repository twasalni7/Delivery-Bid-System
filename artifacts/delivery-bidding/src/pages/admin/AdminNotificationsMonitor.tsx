import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { AdminPageTabs } from "@/components/admin-page-tabs";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { Bell, RefreshCw, CheckCircle, XCircle, Smartphone, Users, TrendingUp, MousePointerClick } from "lucide-react";

interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  clicked: number;
  deliveryRate: string;
  clickRate: string;
}

interface SubscriptionsByRole {
  clients: number;
  drivers: number;
  admins: number;
}

interface NotifMonitor {
  totalNotifications: number;
  totalSubscriptions: number;
  subscriptionsByRole: SubscriptionsByRole;
  deliveryStats: DeliveryStats;
  recentNotifications: Array<{
    id: number;
    title: string;
    message: string;
    userRole: string;
    type: string;
    deliveredAt: string | null;
    clickedAt: string | null;
    createdAt: string;
  }>;
  pushStatus: "configured" | "not_configured";
}

const ROLE_LABEL: Record<string, string> = {
  client: "عميل",
  driver: "سائق",
  admin: "مشرف",
};

const TYPE_LABEL: Record<string, string> = {
  offer: "عرض",
  request: "طلب",
  system: "نظام",
  support: "دعم",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: "var(--brand-subtle)", color: color ?? "var(--brand)" }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color: color ?? "var(--text)" }}>{value}</div>
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>{sub}</div>}
    </div>
  );
}

export default function AdminNotificationsMonitor() {
  const [data, setData] = useState<NotifMonitor | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/notifications-monitor`, { headers: getAuthHeaders() });
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const s = data?.subscriptionsByRole;
  const d = data?.deliveryStats;

  return (
    <Layout role="admin">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        <AdminPageTabs
          tabs={[
            { href: "/admin/notifications", label: "إرسال الإشعارات" },
            { href: "/admin/notifications-monitor", label: "مراقبة الإشعارات" },
            { href: "/admin/push-debug", label: "تشخيص Push" },
          ]}
        />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>مراقبة الإشعارات</h1>
          <button
            onClick={() => void fetchData()}
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
            {/* Push / OneSignal status banner */}
            <div
              className="flex items-center gap-3 rounded-2xl p-4"
              style={{
                backgroundColor: "var(--surface)",
                border: `1px solid ${data?.pushStatus === "configured" ? "var(--status-active-border)" : "var(--status-cancelled-border)"}`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: data?.pushStatus === "configured" ? "var(--status-active-text)" : "var(--status-cancelled-text)" }}
              />
              <div>
                <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                  {data?.pushStatus === "configured" ? "OneSignal مُهيّأ ✓ — الإشعارات الخارجية تعمل" : "OneSignal غير مُهيّأ"}
                </div>
                {data?.pushStatus !== "configured" && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    يرجى إضافة ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY في متغيرات البيئة
                  </div>
                )}
              </div>
              {data?.pushStatus === "configured"
                ? <CheckCircle size={18} className="mr-auto shrink-0" style={{ color: "var(--status-active-text)" }} />
                : <XCircle size={18} className="mr-auto shrink-0" style={{ color: "var(--status-cancelled-text)" }} />
              }
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={<Bell size={20} />}
                label="إجمالي الإشعارات"
                value={d?.total ?? 0}
              />
              <StatCard
                icon={<Smartphone size={20} />}
                label="الأجهزة المشتركة"
                value={data?.totalSubscriptions ?? 0}
              />
              <StatCard
                icon={<TrendingUp size={20} />}
                label="معدل التوصيل"
                value={d?.deliveryRate ?? "0%"}
                sub={`${d?.delivered ?? 0} من ${d?.total ?? 0}`}
              />
              <StatCard
                icon={<MousePointerClick size={20} />}
                label="معدل النقر"
                value={d?.clickRate ?? "0%"}
                sub={`${d?.clicked ?? 0} نقرة`}
              />
            </div>

            {/* Subscriptions by role */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text)" }}>
                <Users size={16} />
                الاشتراكات حسب الدور
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "العملاء", value: s?.clients ?? 0 },
                  { label: "السائقون", value: s?.drivers ?? 0 },
                  { label: "المشرفون", value: s?.admins ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: "var(--surface-2)" }}>
                    <p className="text-xl font-bold" style={{ color: "var(--brand)" }}>{value}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                            {ROLE_LABEL[n.userRole] ?? n.userRole}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-hint)" }}>
                            {TYPE_LABEL[n.type] ?? n.type}
                          </span>
                          {n.deliveredAt && (
                            <span className="text-xs" style={{ color: "var(--status-active-text)" }}>✓ وصل</span>
                          )}
                          {n.clickedAt && (
                            <span className="text-xs" style={{ color: "var(--status-active-text)" }}>✓ نُقر</span>
                          )}
                          {!n.deliveredAt && (
                            <span className="text-xs" style={{ color: "var(--text-hint)" }}>⏳ في الانتظار</span>
                          )}
                        </div>
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
