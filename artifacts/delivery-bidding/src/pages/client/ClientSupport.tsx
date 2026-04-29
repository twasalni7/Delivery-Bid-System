import { useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
      const r = await fetch(`${API_BASE}/support-tickets/my`, { credentials: "include" });
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
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
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
            <h1 className="text-2xl font-black text-white">الدعم والمساعدة</h1>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>تواصل معنا عند أي مشكلة</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm"
            style={{ backgroundColor: "#deff9a", color: "#0a0a0a" }}>
            <Plus size={16} /> تذكرة جديدة
          </button>
        </div>

        {showForm && (
          <div className="rounded-3xl p-6 mb-6" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="font-black text-white mb-5">إرسال تذكرة دعم</p>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold block mb-2.5" style={{ color: "rgba(255,255,255,0.6)" }}>نوع المشكلة</label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button key={t} onClick={() => setType(t)}
                      className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors"
                      style={type === t
                        ? { backgroundColor: "#deff9a", color: "#0a0a0a" }
                        : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>رقم الطلب (اختياري)</label>
                <input type="number" placeholder="مثال: 42" value={requestId} onChange={(e) => setRequestId(e.target.value)}
                  className="input-dark w-full" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>اشرح مشكلتك</label>
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
          <div className="text-center py-16 font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "#111111", border: "2px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-4xl mb-3">🎫</p>
            <p className="font-black text-white">لا توجد تذاكر دعم بعد</p>
            <p className="text-sm font-bold mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>اضغط "تذكرة جديدة" لإرسال استفسارك</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-3xl p-5" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-black text-sm text-white">{t.type}</span>
                      {t.requestId && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                          طلب #{t.requestId}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getTicketStatusColor(t.status)}`}>
                        {getTicketStatusLabel(t.status)}
                      </span>
                    </div>
                    <p className="text-sm font-bold mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{t.message}</p>
                    {t.adminReply && (
                      <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <p className="text-xs font-black mb-1.5" style={{ color: "#34d399" }}>رد الإدارة:</p>
                        <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{t.adminReply}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>#{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
