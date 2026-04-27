import { useState } from "react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

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
      const r = await fetch(`${API_BASE}/support-tickets/driver/my`, { credentials: "include" });
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">الدعم والمساعدة</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {tickets.length > 0
                ? `${tickets.length} تذكرة${unrepliedCount > 0 ? ` — ${unrepliedCount} بانتظار الرد` : ""}`
                : "تواصل معنا عند أي مشكلة"}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-black shadow-md active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}
          >
            <Plus size={16} />
            تذكرة جديدة
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 mb-5">
            <p className="font-black text-gray-800 mb-4">إرسال تذكرة دعم جديدة</p>
            <div className="space-y-4">
              {/* Ticket type */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">نوع المشكلة</label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                        type === t
                          ? "text-white border-emerald-600"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-300"
                      }`}
                      style={type === t ? { background: "linear-gradient(135deg, #064E3B, #065F46)" } : {}}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Request ID (optional) */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  رقم الطلب (اختياري)
                </label>
                <input
                  type="number"
                  placeholder="مثال: 12"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  تفاصيل المشكلة
                </label>
                <Textarea
                  placeholder="اشرح مشكلتك بالتفصيل..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="rounded-xl border-gray-200 focus:border-emerald-400"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || !message.trim()}
                  className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-50 active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}
                >
                  {submit.isPending ? "جاري الإرسال..." : "إرسال التذكرة"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tickets list */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 font-bold">جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-xl font-black text-gray-600">لا توجد تذاكر</p>
            <p className="text-gray-400 text-sm mt-1">أرسل تذكرة إذا واجهت أي مشكلة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const isOpen = expanded === t.id;
              return (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div
                    className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-black text-gray-800 text-sm">{t.type}</span>
                        {t.requestId && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            طلب #{t.requestId}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getTicketStatusColor(t.status)}`}
                        >
                          {getTicketStatusLabel(t.status)}
                        </span>
                        {t.adminReply && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                            رُدّ عليها
                          </span>
                        )}
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
                        <p className="text-xs font-bold text-gray-400 mb-1">رسالتك:</p>
                        <p className="text-sm text-gray-700">{t.message}</p>
                      </div>
                      {t.adminReply && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-emerald-600 mb-1">رد الإدارة:</p>
                          <p className="text-sm text-emerald-800">{t.adminReply}</p>
                        </div>
                      )}
                      {!t.adminReply && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-amber-600">⏳ في انتظار رد الإدارة...</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        أُرسلت في {new Date(t.createdAt).toLocaleDateString("ar-SA", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
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
