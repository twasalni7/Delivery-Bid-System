import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { MessageCircle, Send, X } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";
import { useToast } from "@/hooks/use-toast";

import { API_ORIGIN as API } from "@/lib/api-config";

const STATUS_PILL: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  SELECTED: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح", SELECTED: "تم الاختيار", ACTIVE: "نشط", COMPLETED: "مكتمل",
};

type Message = { id: number; senderRole: string; senderId: number; body: string; createdAt: string };

type DriverRequest = {
  id: number; homeLocation: string; workLocation: string;
  morningTime: string; eveningTime: string | null;
  shifts?: { label?: string; goTime: string; returnTime?: string }[] | null;
  numberOfPeople: number; workingDaysPerWeek: number;
  status: string; phone: string | null; createdAt: string;
};

export default function DriverRequests() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "current" | "past">("all");
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!user) setLocation("/driver/login"); }, [user, setLocation]);

  const { data: requests, isLoading } = useQuery<DriverRequest[]>({
    queryKey: ["driver-me-requests"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/drivers/me/requests`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب البيانات");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: chatMessages } = useQuery<Message[]>({
    queryKey: ["messages", openChatId],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/${openChatId}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب الرسائل");
      return res.json();
    },
    enabled: !!openChatId,
    refetchInterval: 5_000,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/messages/${openChatId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatMessage.trim() }),
      });
      if (!res.ok) throw new Error("فشل إرسال الرسالة");
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", openChatId] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (!user) return null;

  const filtered = (requests ?? []).filter((r) => {
    if (filter === "current") return r.status === "ACTIVE" || r.status === "SELECTED";
    if (filter === "past") return r.status === "COMPLETED";
    return true;
  });

  return (
    <Layout role="driver">
      <div dir="rtl">
        <div className="mb-5">
          <h1 className="text-[1.8rem] font-black text-[#0F172A] tracking-tight">اتفاقياتي</h1>
          <p className="text-slate-400 font-bold text-sm">الطلبات التي تم اختيارك فيها</p>
        </div>

        <div className="flex gap-2 mb-5">
          {([["all", "الكل"], ["current", "الحالية"], ["past", "السابقة"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full text-sm font-black border-2 transition-colors ${
                filter === f ? "text-white border-transparent shadow-md" : "bg-white border-slate-100 text-slate-500"
              }`}
              style={filter === f ? { background: "linear-gradient(135deg, #312E81, #4338CA)" } : {}}>
              {label}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-center py-16 text-slate-400 font-bold">جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-black text-[#0F172A]">لا توجد اتفاقيات</p>
            <p className="text-sm font-bold text-slate-400 mt-1">لم يتم اختيارك في أي طلب بعد</p>
            <Link href="/driver/dashboard"
              className="mt-4 inline-block px-5 py-2.5 rounded-full border-2 border-slate-200 text-sm font-black text-slate-600">
              العودة للوحة السائق
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/60 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-slate-50"
                style={{ background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)" }}>
                <span className="text-xs text-[#312E81] font-black">طلب #{r.id}</span>
                <span className={`text-xs px-3 py-1 rounded-full font-black ${STATUS_PILL[r.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="space-y-2 relative pr-3">
                  <div className="absolute right-[5px] top-3 bottom-3 w-[3px] bg-slate-100 rounded-full" />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-[#312E81] border-3 border-white shadow-sm mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700 font-black">{r.homeLocation}</p>
                  </div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-rose-500 border-3 border-white shadow-sm mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700 font-black">{r.workLocation}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-black text-slate-500" dir="ltr">
                  {r.shifts && r.shifts.length > 0 ? (
                    <span>⏰ {r.shifts.map((s) => `${formatTime12h(s.goTime)}${s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}`).join(" | ")}</span>
                  ) : (
                    <span>⏰ {formatTime12h(r.morningTime)}{r.eveningTime ? ` – ${formatTime12h(r.eveningTime)}` : ""}</span>
                  )}
                  <span>👥 {r.numberOfPeople} أشخاص · {r.workingDaysPerWeek} أيام/أسبوع</span>
                </div>
                <p className="text-xs font-bold text-slate-300">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</p>
              </div>
              <div className="px-5 pb-4 pt-3 border-t border-slate-100 space-y-3">
                {r.phone && (
                  <div className="flex items-center justify-between">
                    <a href={`tel:${r.phone}`} className="font-black text-sm text-[#312E81]" dir="ltr">{r.phone}</a>
                    <a href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border-2 border-emerald-200">
                      <MessageCircle size={13} /> واتساب العميل
                    </a>
                  </div>
                )}
                {(r.status === "SELECTED" || r.status === "ACTIVE") && (
                  <button onClick={() => setOpenChatId(openChatId === r.id ? null : r.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-black border-2 border-[#312E81]/20 text-[#312E81] bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors">
                    <MessageCircle size={15} /> {openChatId === r.id ? "إخفاء المحادثة" : "فتح المحادثة"}
                  </button>
                )}
                {openChatId === r.id && (
                  <div className="rounded-2xl border-2 border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-100">
                      <span className="text-xs font-black text-slate-600">محادثة الطلب #{r.id}</span>
                      <button onClick={() => setOpenChatId(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2 bg-white">
                      {(!chatMessages || chatMessages.length === 0) && (
                        <p className="text-center text-xs text-slate-400 py-4">لا توجد رسائل بعد</p>
                      )}
                      {chatMessages?.map((msg) => {
                        const isMe = msg.senderRole === "driver";
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMe ? "text-white" : "bg-slate-100 text-slate-700"}`}
                              style={isMe ? { background: "linear-gradient(135deg, #312E81, #4338CA)" } : {}}>
                              {!isMe && <p className="text-[10px] font-bold text-slate-400 mb-0.5">{msg.senderRole === "admin" ? "الإدارة" : "العميل"}</p>}
                              <p>{msg.body}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="border-t border-slate-100 p-2 flex gap-2 bg-white">
                      <input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) { e.preventDefault(); sendMessage.mutate(); } }}
                        placeholder="اكتب رسالة..."
                        className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#312E81]/20"
                        dir="rtl"
                      />
                      <button onClick={() => { if (chatMessage.trim()) sendMessage.mutate(); }}
                        disabled={!chatMessage.trim() || sendMessage.isPending}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #312E81, #4338CA)" }}>
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
