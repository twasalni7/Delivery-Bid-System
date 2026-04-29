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
  OPEN:      "pill-open",
  SELECTED:  "pill-selected",
  ACTIVE:    "pill-active",
  COMPLETED: "pill-completed",
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
        <div className="mb-7">
          <h1 className="text-[1.9rem] font-black text-white tracking-tight">قائمة الاتفاقات</h1>
          <p className="font-bold text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>الطلبات التي تم اختيارك فيها</p>
        </div>

        <div className="flex gap-2 mb-6">
          {([["all", "الكل"], ["current", "الحالية"], ["past", "السابقة"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-5 py-2.5 rounded-full text-sm font-black transition-all"
              style={filter === f
                ? { backgroundColor: "#deff9a", color: "#0a0a0a" }
                : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16 font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>جاري التحميل...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "#111111", border: "2px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-black text-white">لا توجد اتفاقيات</p>
            <p className="text-sm font-bold mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>لم يتم اختيارك في أي طلب بعد</p>
            <Link href="/driver/dashboard"
              className="mt-5 inline-block px-5 py-2.5 rounded-full text-sm font-black"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
              العودة للوحة السائق
            </Link>
          </div>
        )}

        <div className="space-y-5">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Card header */}
              <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2"
                style={{ backgroundColor: "#1a1a1a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.4)" }}>طلب #{r.id}</span>
                <span className={`text-xs px-3 py-1 rounded-full font-black ${STATUS_PILL[r.status] ?? "pill-completed"}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>

              {/* Route */}
              <div className="px-5 py-5 space-y-4">
                <div className="space-y-3 relative pr-3">
                  <div className="absolute right-[5px] top-4 bottom-4 w-[2px] rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#deff9a", boxShadow: "0 0 8px rgba(222,255,154,0.4)" }} />
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>الانطلاق</p>
                      <p className="text-sm text-white font-black">{r.homeLocation}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#f87171", boxShadow: "0 0 8px rgba(248,113,113,0.4)" }} />
                    <div>
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>الوصول</p>
                      <p className="text-sm text-white font-black">{r.workLocation}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs font-black" style={{ color: "rgba(255,255,255,0.45)" }} dir="ltr">
                  {r.shifts && r.shifts.length > 0 ? (
                    <span>⏰ {r.shifts.map((s) => `${formatTime12h(s.goTime)}${s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}`).join(" | ")}</span>
                  ) : (
                    <span>⏰ {formatTime12h(r.morningTime)}{r.eveningTime ? ` – ${formatTime12h(r.eveningTime)}` : ""}</span>
                  )}
                  <span>👥 {r.numberOfPeople} أشخاص · {r.workingDaysPerWeek} أيام/أسبوع</span>
                </div>

                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                </p>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 pt-3 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {r.phone && (
                  <div className="flex items-center justify-between gap-3">
                    <a href={`tel:${r.phone}`} className="font-black text-sm" style={{ color: "rgba(255,255,255,0.6)" }} dir="ltr">{r.phone}</a>
                    <a href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black"
                      style={{ backgroundColor: "#25D366", color: "#fff", boxShadow: "0 2px 12px rgba(37,211,102,0.3)" }}>
                      <MessageCircle size={14} /> واتساب العميل
                    </a>
                  </div>
                )}
                {(r.status === "SELECTED" || r.status === "ACTIVE") && (
                  <button onClick={() => setOpenChatId(openChatId === r.id ? null : r.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black transition-colors"
                    style={openChatId === r.id
                      ? { backgroundColor: "rgba(222,255,154,0.1)", color: "#deff9a", border: "1px solid rgba(222,255,154,0.2)" }
                      : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <MessageCircle size={15} /> {openChatId === r.id ? "إخفاء المحادثة" : "فتح المحادثة"}
                  </button>
                )}
                {openChatId === r.id && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "#1a1a1a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.5)" }}>محادثة الطلب #{r.id}</span>
                      <button onClick={() => setOpenChatId(null)} style={{ color: "rgba(255,255,255,0.35)" }}><X size={14} /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2" style={{ backgroundColor: "#0d0d0d" }}>
                      {(!chatMessages || chatMessages.length === 0) && (
                        <p className="text-center text-xs py-4" style={{ color: "rgba(255,255,255,0.3)" }}>لا توجد رسائل بعد</p>
                      )}
                      {chatMessages?.map((msg) => {
                        const isMe = msg.senderRole === "driver";
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                              style={isMe
                                ? { backgroundColor: "#deff9a", color: "#0a0a0a" }
                                : { backgroundColor: "#1e1e1e", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                              {!isMe && <p className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{msg.senderRole === "admin" ? "الإدارة" : "العميل"}</p>}
                              <p>{msg.body}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-2 flex gap-2" style={{ backgroundColor: "#111111", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) { e.preventDefault(); sendMessage.mutate(); } }}
                        placeholder="اكتب رسالة..."
                        className="flex-1 text-sm px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                        dir="rtl"
                      />
                      <button onClick={() => { if (chatMessage.trim()) sendMessage.mutate(); }}
                        disabled={!chatMessage.trim() || sendMessage.isPending}
                        className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50"
                        style={{ backgroundColor: "#deff9a", color: "#0a0a0a" }}>
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
