import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Bell, Users, TrendingUp, Clock, Shield, Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OpsStats {
  todayRequests: number;
  activeRequests: number;
  delayedRequests: number;
  connectedDrivers: number;
  totalDrivers: number;
  totalClients: number;
  currentErrors: number;
  totalNotifications: number;
}

interface ServiceHealth {
  name: string;
  nameAr: string;
  status: "healthy" | "warning" | "error";
  lastCheck: string;
}

interface SystemHealth {
  services: ServiceHealth[];
  overall: "healthy" | "warning" | "error";
  timestamp: string;
}

interface SystemError {
  id: number;
  errorType: string;
  message: string;
  page: string | null;
  userRole: string | null;
  count: number;
  severity: string;
  resolved: boolean;
  createdAt: string;
}

interface SystemAlert {
  id: number;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusStyle(status: string): React.CSSProperties {
  if (status === "healthy") return { color: "var(--status-active-text)", backgroundColor: "var(--status-active-bg)" };
  if (status === "warning") return { color: "var(--status-open-text)", backgroundColor: "var(--status-open-bg)" };
  return { color: "var(--status-cancelled-text)", backgroundColor: "var(--status-cancelled-bg)" };
}

function severityStyle(severity: string): React.CSSProperties {
  if (severity === "info") return { color: "var(--status-active-text)", backgroundColor: "var(--status-active-bg)" };
  if (severity === "warning") return { color: "var(--status-open-text)", backgroundColor: "var(--status-open-bg)" };
  return { color: "var(--status-cancelled-text)", backgroundColor: "var(--status-cancelled-bg)" };
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

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, warn, error, sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  warn?: boolean;
  error?: boolean;
  sublabel?: string;
}) {
  const dotStyle: React.CSSProperties = error
    ? { backgroundColor: "var(--status-cancelled-text)" }
    : warn
    ? { backgroundColor: "var(--status-open-text)" }
    : { backgroundColor: "var(--status-active-text)" };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
        >
          {icon}
        </div>
        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={dotStyle} />
      </div>
      <div>
        <div className="text-3xl font-bold" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </div>
        <div className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
        {sublabel && <div className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>{sublabel}</div>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminOperations() {
  const { toast } = useToast();
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, healthRes, errorsRes, alertsRes, maintenanceRes] = await Promise.all([
        fetch(`${API}/api/admin/operations-stats`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/admin/system-health`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/admin/live-errors?limit=30`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/admin/operations-alerts`, { headers: getAuthHeaders() }),
        fetch(`${API}/api/admin/maintenance-mode`, { headers: getAuthHeaders() }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (errorsRes.ok) setErrors(await errorsRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (maintenanceRes.ok) { const m = await maintenanceRes.json(); setMaintenance(m.enabled); }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("fetch ops data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/maintenance-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ enabled: !maintenance }),
      });
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data.enabled);
        toast({ title: data.enabled ? "تم تفعيل وضع الصيانة" : "تم إلغاء وضع الصيانة" });
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const resolveError = async (id: number) => {
    const res = await fetch(`${API}/api/admin/live-errors/${id}/resolve`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setErrors(prev => prev.filter(e => e.id !== id));
      toast({ title: "تم وضع علامة حلّ على الخطأ" });
    }
  };

  const dismissAlert = async (id: number) => {
    const res = await fetch(`${API}/api/admin/operations-alerts/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    if (res.ok) setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const filteredErrors = errors.filter(
    (e) => !e.resolved && (severityFilter === "all" || e.severity === severityFilter)
  );

  if (loading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
          <RefreshCw className="animate-spin ml-2" size={20} />
          جاري تحميل بيانات التشغيل...
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>مركز التحكم والمراقبة</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              آخر تحديث: {lastRefresh.toLocaleTimeString("ar")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={15} />
              تحديث
            </button>
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={maintenance
                ? { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)" }
                : { backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }
              }
            >
              <Shield size={15} />
              {maintenance ? "✓ وضع الصيانة نشط" : "تفعيل وضع الصيانة"}
            </button>
          </div>
        </div>

        {/* Maintenance banner */}
        {maintenance && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)", color: "var(--status-cancelled-text)" }}
          >
            <Shield size={20} />
            <div>
              <div className="font-bold text-sm">وضع الصيانة مفعّل</div>
              <div className="text-xs opacity-80">العملاء والسائقون لا يستطيعون الوصول للتطبيق حالياً.</div>
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={<TrendingUp size={18} />} label="طلبات اليوم" value={stats?.todayRequests ?? 0} />
          <StatCard icon={<Activity size={18} />} label="الطلبات النشطة" value={stats?.activeRequests ?? 0} warn={!stats?.activeRequests} />
          <StatCard icon={<Clock size={18} />} label="الطلبات المتأخرة" value={stats?.delayedRequests ?? 0} error={!!stats?.delayedRequests} sublabel="مفتوح > 48 ساعة" />
          <StatCard icon={<Users size={18} />} label="السائقون النشطون" value={stats?.connectedDrivers ?? 0} />
          <StatCard icon={<Users size={18} />} label="إجمالي السائقين" value={stats?.totalDrivers ?? 0} />
          <StatCard icon={<Users size={18} />} label="إجمالي العملاء" value={stats?.totalClients ?? 0} />
          <StatCard icon={<AlertTriangle size={18} />} label="الأخطاء الحالية" value={stats?.currentErrors ?? 0} error={!!stats?.currentErrors} />
          <StatCard icon={<Bell size={18} />} label="الإشعارات المرسلة" value={stats?.totalNotifications ?? 0} />
        </div>

        {/* System health */}
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>حالة النظام</h2>
            <div className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg" style={statusStyle(health?.overall ?? "healthy")}>
              {health?.overall === "healthy" ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {health?.overall === "healthy" ? "جميع الخدمات تعمل" : health?.overall === "warning" ? "تحذيرات" : "خطأ"}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(health?.services ?? []).map(svc => (
              <div
                key={svc.name}
                className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{svc.nameAr}</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.status === "healthy" ? "var(--status-active-text)" : svc.status === "warning" ? "var(--status-open-text)" : "var(--status-cancelled-text)" }} />
                </div>
                <div className="text-xs font-semibold px-2 py-1 rounded-lg w-fit" style={statusStyle(svc.status)}>
                  {svc.status === "healthy" ? "✓ يعمل" : svc.status === "warning" ? "⚠ تحذير" : "✗ خطأ"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>التنبيهات ({alerts.length})</h2>
            <div className="space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-3 rounded-xl p-3"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="mt-0.5 px-2 py-0.5 rounded text-xs font-medium shrink-0" style={severityStyle(alert.severity)}>
                      {alert.type}
                    </div>
                    <div>
                      <div className="text-sm" style={{ color: "var(--text)" }}>{alert.message}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>{timeAgo(alert.createdAt)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-xs px-2 py-1 rounded-lg shrink-0"
                    style={{ color: "var(--text-hint)", backgroundColor: "var(--surface-3)" }}
                  >
                    تجاهل
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live errors */}
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>
              الأخطاء المباشرة ({filteredErrors.length})
            </h2>
            <div className="flex items-center gap-2">
              <Filter size={14} style={{ color: "var(--text-hint)" }} />
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg outline-none"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                <option value="all">الكل</option>
                <option value="error">خطأ</option>
                <option value="warning">تحذير</option>
                <option value="info">معلومات</option>
              </select>
            </div>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد أخطاء نشطة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["النوع", "الرسالة", "الصفحة", "التكرار", "الخطورة", "الوقت", ""].map((h, i) => (
                      <th key={i} className="text-right pb-2 pr-2 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.map(err => (
                    <tr key={err.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2.5 pr-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-3)", color: "var(--text-sub)" }}>
                          {err.errorType}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 max-w-[200px]">
                        <span className="truncate block" style={{ color: "var(--text)" }}>{err.message}</span>
                      </td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--text-muted)" }}>{err.page ?? "—"}</td>
                      <td className="py-2.5 pr-2 text-center font-bold" style={{ color: "var(--text)" }}>{err.count}</td>
                      <td className="py-2.5 pr-2">
                        <span className="text-xs px-2 py-0.5 rounded font-medium" style={severityStyle(err.severity)}>
                          {err.severity === "error" ? "خطأ" : err.severity === "warning" ? "تحذير" : "معلومات"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap" style={{ color: "var(--text-hint)" }}>{timeAgo(err.createdAt)}</td>
                      <td className="py-2.5 pr-2">
                        <button
                          onClick={() => resolveError(err.id)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ color: "var(--status-active-text)", backgroundColor: "var(--status-active-bg)" }}
                        >
                          حلّ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
