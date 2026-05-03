import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { RefreshCw, ChevronRight, ChevronLeft, Activity } from "lucide-react";

type LogEntry = {
  id: number;
  actorId: number | null;
  actorRole: string;
  action: string;
  entity: string;
  entityId: number | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin:  "مشرف",
  client: "عميل",
  driver: "سائق",
  system: "النظام",
};

const ACTION_COLORS: Record<string, string> = {
  "auth.login":             "var(--status-frozen-text)",
  "client.registered":      "var(--status-active-text)",
  "request.created":        "var(--brand)",
  "request.status_changed": "var(--status-open-text)",
  "offer.created":          "var(--status-open-text)",
  "service_area.created":   "var(--status-active-text)",
  "service_area.updated":   "var(--status-open-text)",
  "service_area.deleted":   "var(--status-cancelled-text)",
};

function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? "var(--text-sub)";
}

export default function AdminActivityLogs() {
  const { toast } = useToast();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  // Filters
  const [filterRole, setFilterRole] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filterRole)   params.set("actorRole", filterRole);
      if (filterAction) params.set("action", filterAction);
      if (filterFrom)   params.set("from", filterFrom);
      if (filterTo)     params.set("to", filterTo);

      const res = await fetch(`${API}/api/activity-logs?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التحميل");
      setLogs(data.data ?? []);
      setHasMore((data.data ?? []).length === pageSize);
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => { setPage(1); fetchLogs(1); };
  const clearFilters = () => {
    setFilterRole(""); setFilterAction(""); setFilterFrom(""); setFilterTo("");
    setPage(1);
    setTimeout(() => fetchLogs(1), 0);
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "short", timeStyle: "medium", hour12: false,
      }).format(new Date(iso));
    } catch { return iso; }
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,0.15)" }}>
              <Activity size={20} style={{ color: "var(--status-frozen-text)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>سجل النشاط</h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>كل العمليات المُسجَّلة في النظام</p>
            </div>
          </div>
          <button
            onClick={() => fetchLogs(page)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold"
            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-[1.5rem] space-y-3" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-bold text-white/60">فلترة السجلات</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white bg-transparent border border-white/10 outline-none"
              dir="rtl"
            >
              <option value="">كل الأدوار</option>
              <option value="admin">مشرف</option>
              <option value="client">عميل</option>
              <option value="driver">سائق</option>
              <option value="system">النظام</option>
            </select>
            <input
              type="text"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              placeholder="العملية (مثال: auth.login)"
              className="px-3 py-2 rounded-xl text-sm text-white bg-transparent border border-white/10 outline-none placeholder:text-white/30"
              dir="ltr"
            />
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white bg-transparent border border-white/10 outline-none"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white bg-transparent border border-white/10 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
              تطبيق
            </button>
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}>
              مسح
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          {loading ? (
            <div className="p-12 text-center text-white/40 text-sm">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-sm">لا توجد سجلات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr style={{ backgroundColor: "var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                    {["#", "الوقت", "الدور", "الهوية", "العملية", "الجدول", "المعرف", "IP"].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-bold text-white/50 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr
                      key={log.id}
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-white/30 font-mono text-xs">{(page - 1) * pageSize + i + 1}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap font-mono text-xs">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}>
                          {ROLE_LABELS[log.actorRole] ?? log.actorRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{log.actorId ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold" style={{ color: actionColor(log.action) }}>{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{log.entity}</td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{log.entityId ?? "—"}</td>
                      <td className="px-4 py-3 text-white/30 font-mono text-xs">{log.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}
          >
            <ChevronRight size={16} /> السابق
          </button>
          <span className="text-sm text-white/40">صفحة {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}
          >
            التالي <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    </Layout>
  );
}
