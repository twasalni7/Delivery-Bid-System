import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { MessageCircle, Send, X } from "lucide-react";
import { MapButtons } from "@/components/MapButtons";
import { LocationDisplay } from "@/components/LocationDisplay";
import { formatTime12hLong } from "@/lib/time-utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp-utils";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

import { API_ORIGIN as API } from "@/lib/api-config";

const STATUS_PILL: Record<string, string> = {
  OPEN:      "pill-open",
  SELECTED:  "pill-selected",
  ACTIVE:    "pill-active",
  COMPLETED: "pill-completed",
  CANCELLED: "pill-cancelled",
  EXPIRED:   "pill-cancelled",
  FROZEN:    "pill-frozen",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN:      "قيد الانتظار",
  SELECTED:  "نشط",
  ACTIVE:    "نشط",
  COMPLETED: "منتهي",
  CANCELLED: "منتهي",
  EXPIRED:   "منتهي",
  FROZEN:    "قيد الانتظار",
};

type Message = { id: number; senderRole: string; senderId: number; body: string; createdAt: string };

type DriverRequest = {
  id: number; homeLocation: string; workLocation: string;
  morningTime: string; eveningTime: string | null;
  shifts?: { label?: string; goTime: string; returnTime?: string }[] | null;
  numberOfPeople: number; workingDaysPerWeek: number;
  monthlyPrice?: number;
  homeLat?: number | null; homeLng?: number | null;
  destLat?: number | null; destLng?: number | null;
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
      const res = await fetch(`${API}/api/drivers/me/requests`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل جلب البيانات");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 15_000,
  });

  // Real-time: refresh when any request status changes (e.g., SELECTED → ACTIVE)
  useRealtimeRefresh(
    "driver-requests-realtime",
    [{ table: "requests", events: ["UPDATE"] }],
    [["driver-me-requests"]],
    !!user
  );

  const { data: chatMessages } = useQuery<Message[]>({
    queryKey: ["messages", openChatId],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/${openChatId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل جلب الرسائل");
      return res.json();
    },
    enabled: !!openChatId,
    refetchInterval: 5_000,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/messages/${openChatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    if (filter === "past") return r.status === "COMPLETED" || r.status === "CANCELLED" || r.status === "EXPIRED";
    return true;
  });

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-4">
        <div className="mb-3">
          <h1 className="text-[1.85rem] font-black tracking-tight" style={{ color: "var(--text)" }}>اشتراكاتي</h1>
          <p className="font-bold text-sm mt-1" style={{ color: "var(--text-muted)" }}>الطلبات التي تم اختيارك فيها</p>
        </div>

        <div className="flex gap-2 mb-6">
          {([["all", "الكل"], ["current", "الحالية"], ["past", "السابقة"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-5 py-2.5 rounded-full text-sm font-black transition-all"
              style={filter === f
                ? { background: "linear-gradient(180deg, #ea1e3f 0%, #cf1232 100%)", color: "var(--brand-fg)" }
                : { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-black" style={{ color: "var(--text)" }}>لا توجد اتفاقيات</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--text-hint)" }}>لم يتم اختيارك في أي طلب بعد</p>
            <Link href="/driver/dashboard"
              className="mt-5 inline-block px-5 py-2.5 rounded-full text-sm font-black"
              style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border)" }}>
              العودة للوحة السائق
            </Link>
          </div>
        )}

        <div className="space-y-5">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "2px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)" }}>
              {/* Card header */}
              <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2"
                style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                <span className="text-base font-black" style={{ color: "#111827" }}>طلب #{r.id}</span>
                <span className={`text-sm px-3 py-1 rounded-full font-black ${STATUS_PILL[r.status] ?? "pill-completed"}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>

              {/* Route */}
              <div className="px-5 py-5 space-y-4">
                <div className="space-y-3 relative pr-3">
                  <div className="absolute right-[5px] top-4 bottom-4 w-[2px] rounded-full" style={{ backgroundColor: "#E5E7EB" }} />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#10B981", boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" }} />
                    <div>
                      <p className="text-sm font-bold mb-0.5" style={{ color: "#6B7280" }}>الانطلاق</p>
                      <LocationDisplay value={r.homeLocation} className="text-lg font-black" style={{ color: "#111827" }} />
                    </div>
                  </div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#EF4444", boxShadow: "0 0 8px rgba(239, 68, 68, 0.4)" }} />
                    <div>
                      <p className="text-sm font-bold mb-0.5" style={{ color: "#6B7280" }}>الوصول</p>
                      <LocationDisplay value={r.workLocation} className="text-lg font-black" style={{ color: "#111827" }} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-base font-black" style={{ color: "#111827" }} dir="ltr">
                  {r.shifts && r.shifts.length > 0 ? (
                    <span>⏰ {r.shifts.map((s) => `الذهاب: ${formatTime12hLong(s.goTime ?? "")}${s.returnTime ? ` | العودة: ${formatTime12hLong(s.returnTime)}` : ""}`).join(" | ")}</span>
                  ) : (
                    <span>⏰ الذهاب: {formatTime12hLong(r.morningTime)}{r.eveningTime ? ` | العودة: ${formatTime12hLong(r.eveningTime)}` : ""}</span>
                  )}
                  <span>👥 {r.numberOfPeople} أشخاص · {r.workingDaysPerWeek} أيام/أسبوع</span>
                </div>

                {/* أزرار الخريطة الموحدة */}
                <MapButtons
                  homeLat={r.homeLat}
                  homeLng={r.homeLng}
                  destLat={r.destLat}
                  destLng={r.destLng}
                />

                {/* Price breakdown */}
                {(r as any).monthlyPrice != null && (r as any).monthlyPrice > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-2xl" style={{ backgroundColor: "#EFF6FF", border: "2px solid #3B82F6" }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#6B7280" }}>
                        {r.numberOfPeople > 1 ? "السعر / شخص" : "السعر الشهري"}
                      </p>
                      <p className="font-black text-2xl" style={{ color: "#1D4ED8" }} dir="ltr">
                        {r.numberOfPeople > 1
                          ? ((r as any).monthlyPrice / r.numberOfPeople).toFixed(0)
                          : (r as any).monthlyPrice.toFixed(0)}{" "}ر.س
                      </p>
                    </div>
                    {r.numberOfPeople > 1 && (
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: "#6B7280" }}>الإجمالي ({r.numberOfPeople} أشخاص)</p>
                        <p className="font-black text-xl" style={{ color: "#111827" }} dir="ltr">{(r as any).monthlyPrice.toFixed(0)} ر.س/شهر</p>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-sm font-bold" style={{ color: "#6B7280" }}>
                  {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                </p>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 pt-3 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {r.phone && (
                  <div className="flex items-center justify-between gap-3">
                    <a href={`tel:${r.phone}`} className="font-black text-sm" style={{ color: "var(--text-sub)" }} dir="ltr">{r.phone}</a>
                    <a href={buildWhatsAppUrl(r.phone.replace(/\D/g, "").replace(/^0/, "966"))}
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
                      ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                      : { backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border-subtle)" }}>
                    <MessageCircle size={15} /> {openChatId === r.id ? "إخفاء المحادثة" : "فتح المحادثة"}
                  </button>
                )}
                {openChatId === r.id && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>محادثة الطلب #{r.id}</span>
                      <button onClick={() => setOpenChatId(null)} style={{ color: "var(--text-hint)" }}><X size={14} /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2" style={{ backgroundColor: "var(--header-bg)" }}>
                      {(!chatMessages || chatMessages.length === 0) && (
                        <p className="text-center text-xs py-4" style={{ color: "var(--text-hint)" }}>لا توجد رسائل بعد</p>
                      )}
                      {chatMessages?.map((msg) => {
                        const isMe = msg.senderRole === "driver";
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                              style={isMe
                                ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                                : { backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                              {!isMe && <p className="text-[10px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>{msg.senderRole === "admin" ? "الإدارة" : "العميل"}</p>}
                              <p>{msg.body}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-2 flex gap-2" style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border-subtle)" }}>
                      <input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) { e.preventDefault(); sendMessage.mutate(); } }}
                        placeholder="اكتب رسالة..."
                        className="flex-1 text-sm px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                        dir="rtl"
                      />
                      <button onClick={() => { if (chatMessage.trim()) sendMessage.mutate(); }}
                        disabled={!chatMessage.trim() || sendMessage.isPending}
                        className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50"
                        style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
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

