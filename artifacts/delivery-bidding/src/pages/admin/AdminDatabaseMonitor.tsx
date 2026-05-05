import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { Database, RefreshCw, HardDrive } from "lucide-react";

interface DbTable {
  name: string;
  rowCount: number;
  sizeKb: number;
}

interface DbMonitor {
  tables: DbTable[];
  totalSizeKb: number;
  error?: string;
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const TABLE_NAMES_AR: Record<string, string> = {
  requests: "الطلبات",
  drivers: "السائقون",
  clients: "العملاء",
  offers: "العروض",
  notifications: "الإشعارات",
  push_subscriptions: "اشتراكات Push",
  activity_logs: "سجل النشاط",
  wallet_transactions: "معاملات المحفظة",
  transactions: "المعاملات",
  support_tickets: "تذاكر الدعم",
  messages: "الرسائل",
  system_errors: "أخطاء النظام",
  system_alerts: "تنبيهات النظام",
  request_stops: "محطات الطلبات",
  pricing_matrix: "مصفوفة التسعير",
  app_config: "إعدادات التطبيق",
  service_areas: "مناطق الخدمة",
};

export default function AdminDatabaseMonitor() {
  const [data, setData] = useState<DbMonitor | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/database-monitor`, { headers: getAuthHeaders() });
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
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>مراقبة قاعدة البيانات</h1>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                <Database size={20} />
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{data.tables.length}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>عدد الجداول</div>
            </div>
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                <HardDrive size={20} />
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{formatSize(data.totalSizeKb)}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>الحجم الإجمالي</div>
            </div>
          </div>
        )}

        {data?.error && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ backgroundColor: "var(--status-open-bg)", color: "var(--status-open-text)", border: "1px solid var(--status-open-border)" }}
          >
            ⚠ {data.error}
          </div>
        )}

        {/* Tables list */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text)" }}>الجداول</h2>
          </div>
          {loading && !data ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
              جاري التحميل...
            </div>
          ) : (data?.tables ?? []).length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <Database size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا توجد بيانات متاحة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["الجدول", "عدد السجلات", "الحجم"].map((h, i) => (
                      <th key={i} className="text-right py-3 px-4 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...(data?.tables ?? [])].sort((a, b) => b.rowCount - a.rowCount).map(table => (
                    <tr key={table.name} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-3 px-4">
                        <div className="font-medium" style={{ color: "var(--text)" }}>
                          {TABLE_NAMES_AR[table.name] ?? table.name}
                        </div>
                        <div className="text-xs font-mono" style={{ color: "var(--text-hint)" }}>{table.name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono" style={{ color: "var(--text)" }}>
                        {table.rowCount.toLocaleString("ar")}
                      </td>
                      <td className="py-3 px-4" style={{ color: "var(--text-muted)" }}>
                        {formatSize(table.sizeKb)}
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
