import { useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Ticket = {
  id: number; clientId: number | null; driverId: number | null; requestId: number | null;
  type: string; message: string; status: string; adminReply: string | null;
  submitterName: string | null; createdAt: string; updatedAt: string;
};

const TICKET_STATUSES = [
  { value: "OPEN", label: "مفتوحة" },
  { value: "IN_PROGRESS", label: "قيد المعالجة" },
  { value: "RESOLVED", label: "تم الحل" },
  { value: "CLOSED", label: "مغلقة" },
];

export default function AdminSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, { credentials: "include" });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
  });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const update = useMutation({
    mutationFn: async ({ id, adminReply, status }: { id: number; adminReply?: string; status?: string }) => {
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
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
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }); toast({ title: "تم حذف التذكرة" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = filterStatus === "ALL" ? tickets : tickets.filter((t) => t.status === filterStatus);

  return (
    <Layout role="admin">
      <div className="max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">تذاكر الدعم</h1>
            <p className="text-gray-400 text-sm">
              {tickets.length} تذكرة · {tickets.filter((t) => t.status === "OPEN").length} مفتوحة
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">🎫</div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ value: "ALL", label: "الكل" }, ...TICKET_STATUSES].map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                filterStatus === s.value ? "text-white border-violet-500" : "bg-white border-gray-200 text-gray-500"
              }`}
              style={filterStatus === s.value ? { background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" } : {}}>
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🎫</p>
            <p className="font-bold text-gray-500">لا توجد تذاكر</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const isOpen = expanded === t.id;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : t.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-black text-gray-800 text-sm">{t.type}</span>
                        {t.submitterName && <span className="text-xs text-gray-400">— {t.submitterName}</span>}
                        {t.requestId && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">طلب #{t.requestId}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getTicketStatusColor(t.status)}`}>
                          {getTicketStatusLabel(t.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{t.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-gray-300">
                      <span className="text-xs font-mono">#{t.id}</span>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-400 mb-1">رسالة المستخدم:</p>
                        <p className="text-sm text-gray-700">{t.message}</p>
                      </div>
                      {t.adminReply && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-green-600 mb-1">ردك السابق:</p>
                          <p className="text-sm text-green-800">{t.adminReply}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرد على التذكرة</label>
                        <Textarea
                          placeholder="اكتب ردك هنا..."
                          value={replies[t.id] ?? t.adminReply ?? ""}
                          onChange={(e) => setReplies((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          rows={3} className="rounded-xl border-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">تغيير الحالة</label>
                        <div className="flex gap-2 flex-wrap">
                          {TICKET_STATUSES.map((s) => (
                            <button key={s.value} onClick={() => update.mutate({ id: t.id, status: s.value })}
                              disabled={t.status === s.value || update.isPending}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-50 ${
                                t.status === s.value ? "text-white border-violet-500" : "bg-white border-gray-200 text-gray-500 hover:border-violet-400"
                              }`}
                              style={t.status === s.value ? { background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" } : {}}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: t.id, adminReply: replies[t.id] ?? t.adminReply ?? undefined })}>
                          حفظ الرد
                        </button>
                        <button onClick={() => { if (confirm("هل تريد حذف هذه التذكرة؟")) { remove.mutate(t.id); setExpanded(null); } }}
                          className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:border-red-400">
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
