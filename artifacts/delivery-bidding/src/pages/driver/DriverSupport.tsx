import { useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getAuthHeaders } from "@/lib/authed-fetch";

import { API_ORIGIN } from "@/lib/api-config";
const API_BASE = API_ORIGIN + "/api";

const TICKET_TYPES = ["تأخير", "دفع", "إلغاء", "أخرى"] as const;

type Ticket = {
  id: number;
  type: string;
  message: string;
  status: string;
  adminReply: string | null;
  requestId: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function DriverSupport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["driver-my-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets/driver/my`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<string>("أخرى");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          type,
          message,
          requestId: requestId ? Number(requestId) : undefined,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || "فشل الإرسال");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-my-tickets"] });
      toast({ title: "✅ تم إرسال تذكرتك", description: "سيتم الرد عليك قريباً" });
      setShowForm(false);
      setMessage("");
      setType("أخرى");
      setRequestId("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const unrepliedCount = tickets.filter((t) => !t.adminReply && t.status === "OPEN").length;

  return (
    <Layout role="driver">
      <div className="max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-black text-white">الدعم والمساعدة</h1>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>
              {tickets.length > 0
                ? `${tickets.length} تذكرة${unrepliedCount > 0 ? ` — ${unrepliedCount} بانتظار الرد` : ""}`
                : "تواصل معنا عند أي مشكلة"}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm"
            style={{ backgroundColor: "var(--brand)", color: "var(--bg)" }}
          >
            <Plus size={16} />
            تذكرة جديدة
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="rounded-3xl p-6 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="font-black text-white mb-5">إرسال تذكرة دعم جديدة</p>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold block mb-2.5" style={{ color: "var(--text-sub)" }}>نوع المشكلة</label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors"
                      style={type === t
                        ? { backgroundColor: "var(--brand)", color: "var(--bg)" }
                        : { backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>
                  رقم الطلب (اختياري)
                </label>
                <input
                  type="number"
                  placeholder="مثال: 12"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="input-dark w-full"
                />
              </div>

              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>
                  تفاصيل المشكلة
                </label>
                <textarea
                  placeholder="اشرح مشكلتك بالتفصيل..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="input-dark w-full resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || !message.trim()}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {submit.isPending ? "جاري الإرسال..." : "إرسال التذكرة"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 btn-ghost rounded-2xl"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tickets list */}
        {isLoading ? (
          <div className="text-center py-16 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
            <MessageSquare size={40} className="mx-auto mb-4" style={{ color: "var(--text-hint)" }} />
            <p className="text-xl font-black text-white">لا توجد تذاكر</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--text-hint)" }}>أرسل تذكرة إذا واجهت أي مشكلة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => {
              const isOpen = expanded === t.id;
              return (
                <div
                  key={t.id}
                  className="rounded-3xl overflow-hidden"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                >
                  <div
                    className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                    style={{ backgroundColor: isOpen ? "var(--surface-2)" : undefined }}
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-black text-white text-sm">{t.type}</span>
                        {t.requestId && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                            طلب #{t.requestId}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getTicketStatusColor(t.status)}`}>
                          {getTicketStatusLabel(t.status)}
                        </span>
                        {t.adminReply && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                            رُدّ عليها
                          </span>
                        )}
                      </div>
                      <p className="text-xs line-clamp-2 font-bold" style={{ color: "var(--text-muted)" }}>{t.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" style={{ color: "var(--text-hint)" }}>
                      <span className="text-xs font-mono">#{t.id}</span>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <div className="rounded-2xl p-3" style={{ backgroundColor: "var(--border-subtle)" }}>
                        <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-hint)" }}>رسالتك:</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>{t.message}</p>
                      </div>
                      {t.adminReply && (
                        <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                          <p className="text-xs font-black mb-1.5" style={{ color: "#34d399" }}>رد الإدارة:</p>
                          <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>{t.adminReply}</p>
                        </div>
                      )}
                      {!t.adminReply && (
                        <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <p className="text-xs font-black" style={{ color: "#fbbf24" }}>⏳ في انتظار رد الإدارة...</p>
                        </div>
                      )}
                      <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                        أُرسلت في {new Date(t.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
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
