import { useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">الدعم والمساعدة</h1>
            <p className="text-gray-400 text-sm">تواصل معنا عند أي مشكلة</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-black shadow-md"
            style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
            <Plus size={16} /> تذكرة جديدة
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 mb-5">
            <p className="font-black text-gray-800 mb-4">إرسال تذكرة دعم</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">نوع المشكلة</label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button key={t} onClick={() => setType(t)}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                        type === t ? "text-white border-blue-500" : "bg-gray-50 border-gray-200 text-gray-600"
                      }`}
                      style={type === t ? { background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" } : {}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الطلب (اختياري)</label>
                <input type="number" placeholder="مثال: 42" value={requestId} onChange={(e) => setRequestId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">اشرح مشكلتك</label>
                <Textarea placeholder="اكتب تفاصيل مشكلتك هنا..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="rounded-xl border-gray-200" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600">إلغاء</button>
                <button onClick={() => submit.mutate()} disabled={!message.trim() || submit.isPending}
                  className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
                  {submit.isPending ? "جاري الإرسال..." : "إرسال التذكرة"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🎫</p>
            <p className="font-bold text-gray-500">لا توجد تذاكر دعم بعد</p>
            <p className="text-sm text-gray-400 mt-1">اضغط "تذكرة جديدة" لإرسال استفسارك</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-black text-sm text-gray-800">{t.type}</span>
                      {t.requestId && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">طلب #{t.requestId}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getTicketStatusColor(t.status)}`}>
                        {getTicketStatusLabel(t.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{t.message}</p>
                    {t.adminReply && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                        <p className="text-xs font-bold text-green-600 mb-1">رد الإدارة:</p>
                        <p className="text-sm text-green-800">{t.adminReply}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-300 font-mono shrink-0">#{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
