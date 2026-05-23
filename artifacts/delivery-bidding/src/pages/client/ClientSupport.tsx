import { useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { NotificationToggle } from "@/components/NotificationToggle";

import { API_ORIGIN } from "@/lib/api-config";
const API_BASE = API_ORIGIN + "/api";
const TICKET_TYPES = ["تأخير", "دفع", "إلغاء", "أخرى"] as const;

type Ticket = {
  id: number; type: string; message: string; status: string;
  adminReply: string | null; requestId: number | null; createdAt: string; updatedAt: string;
};

export default function ClientSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets/my`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
    refetchInterval: 30_000,
  });
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<string>("أخرى");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ type, message, requestId: requestId ? Number(requestId) : undefined }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "فشل الإرسال"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      toast({ title: "تم إرسال تذكرتك", description: "سيتم الرد عليك قريباً" });
      setShowForm(false); setMessage(""); setType("أخرى"); setRequestId("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Layout role="client">
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>الدعم والمساعدة</h1>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>تواصل معنا عند أي مشكلة</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
            <Plus size={16} /> تذكرة جديدة
          </button>
        </div>

        {/* قسم إعدادات الإشعارات */}
        <div className="mb-6">
          <h2 className="text-lg font-black mb-3" style={{ color: "var(--text)" }}>الإعدادات</h2>
          <NotificationToggle />
        </div>

        {showForm && (
          <div className="rounded-3xl p-6 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="font-black mb-5" style={{ color: "var(--text)" }}>إرسال تذكرة دعم</p>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold block mb-2.5" style={{ color: "var(--text-sub)" }}>نوع المشكلة</label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button key={t} onClick={() => setType(t)}
                      className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors"
                      style={type === t
                        ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                        : { backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>رقم الطلب (اختياري)</label>
                <input type="number" placeholder="مثال: 42" value={requestId} onChange={(e) => setRequestId(e.target.value)}
                  className="input-dark w-full" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>اشرح مشكلتك</label>
                <textarea
                  placeholder="اكتب تفاصيل مشكلتك هنا..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="input-dark w-full resize-none"
                  style={{ height: "auto" }}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm btn-ghost">
                  إلغاء
                </button>
                <button onClick={() => submit.mutate()} disabled={!message.trim() || submit.isPending}
                  className="flex-1 btn-primary disabled:opacity-50">
                  {submit.isPending ? "جاري الإرسال..." : "إرسال التذكرة"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
            <p className="text-4xl mb-3">🎫</p>
            <p className="font-black" style={{ color: "var(--text)" }}>لا توجد تذاكر دعم بعد</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--text-hint)" }}>اضغط "تذكرة جديدة" لإرسال استفسارك</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-3xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-black text-sm" style={{ color: "var(--text)" }}>{t.type}</span>
                      {t.requestId && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                          طلب #{t.requestId}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getTicketStatusColor(t.status)}`}>
                        {getTicketStatusLabel(t.status)}
                      </span>
                    </div>
                    <p className="text-sm font-bold mb-3" style={{ color: "var(--text-sub)" }}>{t.message}</p>
                    {t.adminReply && (
                      <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--status-active-bg)", border: "1px solid var(--status-active-border)" }}>
                        <p className="text-xs font-black mb-1.5" style={{ color: "var(--status-active-text)" }}>رد الإدارة:</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>{t.adminReply}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-hint)" }}>#{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
