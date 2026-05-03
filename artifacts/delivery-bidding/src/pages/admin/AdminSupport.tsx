import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Trash2, Search, X } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/authed-fetch";

import { API_ORIGIN } from "@/lib/api-config";
const API_BASE = API_ORIGIN + "/api";

type Ticket = {
  id: number; clientId: number | null; driverId: number | null; requestId: number | null;
  type: string; message: string; status: string; adminReply: string | null;
  submitterName: string | null; createdAt: string; updatedAt: string;
};

const TICKET_STATUSES = [
  { value: "OPEN", label: "مفتوحة" },
  { value: "IN_PROGRESS", label: "قيد المعالجة" },
  { value: "LIVE_SUPPORT", label: "دعم مباشر" },
  { value: "RESOLVED", label: "تم الحل" },
  { value: "CLOSED", label: "مغلقة" },
];

const TICKET_TYPES = ["تأخير", "دفع", "إلغاء", "أخرى"];

export default function AdminSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      if (filterType !== "ALL" && t.type !== filterType) return false;
      if (q) {
        const hay = [t.message, t.submitterName ?? "", t.type, String(t.id), String(t.requestId ?? "")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filterStatus, filterType, search]);

  const activeFilters = (filterStatus !== "ALL" ? 1 : 0) + (filterType !== "ALL" ? 1 : 0) + (search ? 1 : 0);
  const resetFilters = () => { setFilterStatus("ALL"); setFilterType("ALL"); setSearch(""); };

  const update = useMutation({
    mutationFn: async ({ id, adminReply, status }: { id: number; adminReply?: string; status?: string }) => {
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ adminReply, status }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "فشل التحديث"); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }); toast({ title: "تم تحديث التذكرة" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }); toast({ title: "تم حذف التذكرة" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const openCount = tickets.filter((t) => t.status === "OPEN").length;

  return (
    <Layout role="admin">
      <div dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black text-white">تذاكر الدعم</h1>
            <p className="text-base mt-0.5" style={{ color: "var(--text-muted)" }}>
              {filtered.length} من {tickets.length} تذكرة
              {openCount > 0 && <span className="mr-2 text-red-500 font-black">· {openCount} مفتوحة</span>}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "var(--brand-subtle)" }}>🎫</div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-colors mb-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <Search size={17} className="text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="ابحث برسالة التذكرة، اسم العميل، النوع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-base bg-transparent outline-none text-white placeholder-gray-600"
          />
          {search && <button onClick={() => setSearch("")} style={{ color: "var(--text-hint)" }}><X size={15} /></button>}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          {/* Status filter */}
          <div className="flex gap-1 flex-wrap">
            {[{ value: "ALL", label: "الكل" }, ...TICKET_STATUSES].map((s) => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className="h-9 px-3.5 rounded-xl text-sm font-bold transition-colors"
                style={filterStatus === s.value ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-xl text-sm font-bold focus:outline-none"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", color: "var(--text-sub)" }}>
            <option value="ALL">كل الأنواع</option>
            {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {activeFilters > 0 && (
            <button onClick={resetFilters}
              className="h-9 px-3.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              <X size={13} /> مسح ({activeFilters})
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ border: "2px dashed var(--border-subtle)" }}>
            <p className="text-4xl mb-3">{activeFilters > 0 ? "🔍" : "🎫"}</p>
            <p className="font-bold" style={{ color: "var(--text-muted)" }}>{activeFilters > 0 ? "لا توجد تذاكر مطابقة" : "لا توجد تذاكر"}</p>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>مسح الفلاتر</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const isOpen = expanded === t.id;
              return (
                <div key={t.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                  <div className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                    style={{ backgroundColor: isOpen ? "var(--surface-2)" : undefined }}
                    onClick={() => setExpanded(isOpen ? null : t.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-black text-white text-sm">{t.type}</span>
                        {t.submitterName && <span className="text-xs" style={{ color: "var(--text-hint)" }}>— {t.submitterName}</span>}
                        {t.requestId && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>طلب #{t.requestId}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getTicketStatusColor(t.status)}`}>
                          {getTicketStatusLabel(t.status)}
                        </span>
                        {t.adminReply && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>رُدّ عليها</span>}
                      </div>
                      <p className="text-xs line-clamp-2" style={{ color: "var(--text-hint)" }}>{t.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" style={{ color: "var(--text-hint)" }}>
                      <span className="text-xs font-mono">#{t.id}</span>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <div className="rounded-xl p-3" style={{ backgroundColor: "var(--border-subtle)" }}>
                        <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>رسالة المستخدم:</p>
                        <p className="text-sm" style={{ color: "var(--text-sub)" }}>{t.message}</p>
                      </div>
                      {t.adminReply && (
                        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                          <p className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>ردك السابق:</p>
                          <p className="text-sm" style={{ color: "var(--text-sub)" }}>{t.adminReply}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>الرد على التذكرة</label>
                        <Textarea
                          placeholder="اكتب ردك هنا..."
                          value={replies[t.id] ?? t.adminReply ?? ""}
                          onChange={(e) => setReplies((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          rows={3} className="rounded-xl outline-none" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", color: "#fff" }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>تغيير الحالة</label>
                        <div className="flex gap-2 flex-wrap">
                          {TICKET_STATUSES.map((s) => (
                            <button key={s.value} onClick={() => update.mutate({ id: t.id, status: s.value })}
                              disabled={t.status === s.value || update.isPending}
                              className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50"
                              style={t.status === s.value ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 py-2.5 rounded-xl font-black disabled:opacity-50"
                          style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: t.id, adminReply: replies[t.id] ?? t.adminReply ?? undefined })}>
                          حفظ الرد
                        </button>
                        <button onClick={() => { if (confirm("هل تريد حذف هذه التذكرة؟")) { remove.mutate(t.id); setExpanded(null); } }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                          style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
