import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useGetRequest, useGetRequestOffers, useSelectOffer, getGetRequestQueryKey, getGetRequestOffersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Phone, MapPin, Clock, Users, Calendar, CheckCircle, MessageCircle, Send, X } from "lucide-react";
import type { Offer } from "@workspace/api-client-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { API_ORIGIN as API } from "@/lib/api-config";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

type Message = { id: number; senderRole: string; senderId: number; body: string; createdAt: string };

const STATUS_GRADIENT: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:      { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)",  text: "#60a5fa" },
  SELECTED:  { bg: "rgba(222,255,154,0.1)", border: "rgba(222,255,154,0.25)", text: "#deff9a" },
  ACTIVE:    { bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  text: "#34d399" },
  COMPLETED: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "rgba(255,255,255,0.4)" },
  CANCELLED: { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",   text: "#f87171" },
  EXPIRED:   { bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.15)", text: "rgba(255,255,255,0.35)" },
  FROZEN:    { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  text: "#60a5fa" },
};

export default function RequestDetails() {
  const [, params] = useRoute("/client/request/:id");
  const id = parseInt((params as { id: string } | null)?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: request, isLoading: loadingReq } = useGetRequest(id, {
    query: { queryKey: getGetRequestQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });
  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(id, {
    query: { queryKey: getGetRequestOffersQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });

  const canChat = request && (request.status === "SELECTED" || request.status === "ACTIVE");

  const { data: chatMessages } = useQuery<Message[]>({
    queryKey: ["messages", id],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب الرسائل");
      return res.json();
    },
    enabled: !!id && showChat,
    refetchInterval: 5_000,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/messages/${id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatMessage.trim() }),
      });
      if (!res.ok) throw new Error("فشل إرسال الرسالة");
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!offers || !id) return;
    const currentCount = offers.length;
    if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
      const newCount = currentCount - prevCountRef.current;
      toast({ title: `${newCount} سائق جديد قبل طلبك!`, description: "تحقق من السائقين المقبِلين أدناه." });
    }
    prevCountRef.current = currentCount;
  }, [offers, id, toast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const selectOffer = useSelectOffer();

  const handleSelect = (offerId: number) => {
    selectOffer.mutate(
      { id, data: { offerId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
          toast({ title: "تم تأكيد السائق بنجاح!" });
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل الاختيار", variant: "destructive" });
        },
      }
    );
  };

  if (loadingReq) {
    return <Layout role="client"><div className="text-center py-20 font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold text-lg text-white">الطلب غير موجود</p>
          <Link href="/client">
            <div className="mt-4 inline-block px-5 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: "#deff9a", color: "#0a0a0a" }}>العودة</div>
          </Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";
  const statusStyle = STATUS_GRADIENT[request.status] ?? STATUS_GRADIENT.OPEN;
  const shifts = (request as any).shifts as Array<{ label?: string; goTime: string; returnTime?: string }> | null | undefined;
  const additionalLocations = (request as any).additionalLocations as Array<{ type: string; address: string }> | null | undefined;
  const notes = (request as any).notes as string | null | undefined;

  return (
    <Layout role="client">
      <div dir="rtl" className="pb-6">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm font-bold transition-colors mb-5"
          style={{ color: "rgba(255,255,255,0.45)" }}>
          <ArrowRight size={14} /> العودة
        </Link>

        {/* Request Summary Card */}
        <div className="rounded-3xl overflow-hidden mb-6" style={{ backgroundColor: "#111111", border: `1px solid ${statusStyle.border}` }}>
          <div className="p-5" style={{ backgroundColor: statusStyle.bg, borderBottom: `1px solid ${statusStyle.border}` }}>
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs font-black px-3 py-1 rounded-full"
                style={{ backgroundColor: statusStyle.border, color: statusStyle.text }}>
                {getStatusLabel(request.status)}
              </span>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>طلب #{request.id}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "#deff9a" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>من</p>
                  <p className="text-white font-black text-sm">{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "#f87171" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>إلى</p>
                  <p className="text-white font-black text-sm">{request.workLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <Clock size={13} />
                  {shifts && shifts.length > 0 ? (
                    <span dir="ltr">{shifts.map((s) => `${formatTime12h(s.goTime)}${s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}`).join(" | ")}</span>
                  ) : (
                    <>
                      <span dir="ltr">{formatTime12h(request.morningTime)}</span>
                      {request.eveningTime && <span dir="ltr"> – {formatTime12h(request.eveningTime)}</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <Users size={13} />
                  <span>{request.numberOfPeople} {request.numberOfPeople === 1 ? "شخص" : "أشخاص"}</span>
                </div>
              </div>
              {additionalLocations && additionalLocations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {additionalLocations.map((loc, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <MapPin size={11} className="shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }} />
                      <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{loc.type === "pickup" ? "استلام إضافي" : "توصيل إضافي"}: {loc.address}</p>
                    </div>
                  ))}
                </div>
              )}
              {notes && (
                <p className="text-xs mt-2 font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>📝 {notes}</p>
              )}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{request.workingDaysPerWeek} أيام/أسبوع</span>
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Price per person</p>
                <p className="text-lg font-black" style={{ color: "#deff9a" }} dir="ltr">
                  {request.monthlyPrice != null && request.numberOfPeople
                    ? (request.monthlyPrice / request.numberOfPeople).toFixed(0)
                    : (request.monthlyPrice?.toFixed(0) ?? "—")}{" "}
                  <span className="text-xs font-normal" style={{ color: "rgba(222,255,154,0.5)" }}>SAR</span>
                </p>
                {request.numberOfPeople > 1 && request.monthlyPrice != null && (
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {request.numberOfPeople} × {(request.monthlyPrice / request.numberOfPeople).toFixed(0)} = {request.monthlyPrice.toFixed(0)} ر.س إجمالي
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_AR.map((d, i) => {
                const active = i < (request.workingDaysPerWeek ?? 5);
                return (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-black"
                    style={active
                      ? { backgroundColor: "rgba(222,255,154,0.1)", color: "#deff9a", border: "1px solid rgba(222,255,154,0.2)" }
                      : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>
                    {d}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {request.selectedDriver && (request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED") && (
          <div className="rounded-3xl overflow-hidden mb-6" style={{ backgroundColor: "#111111", border: "1px solid rgba(222,255,154,0.2)" }}>
            <div className="p-5" style={{ backgroundColor: "rgba(222,255,154,0.07)", borderBottom: "1px solid rgba(222,255,154,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} style={{ color: "#deff9a" }} />
                <span className="font-bold" style={{ color: "#deff9a" }}>
                  {request.status === "COMPLETED" ? "تمت الاتفاقية" : "تم اختيار السائق"}
                </span>
              </div>
              <p className="text-2xl font-black text-white">{request.selectedDriver.name}</p>
              {request.selectedDriver.carType && (
                <p className="text-xs font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{request.selectedDriver.carType}</p>
              )}
            </div>
            {request.selectedDriver.mobile && (
              <div className="px-5 py-4 flex items-center gap-3">
                <Phone size={14} style={{ color: "#34d399" }} />
                <a href={`tel:${request.selectedDriver.mobile}`} className="text-sm font-bold text-white" dir="ltr">
                  {request.selectedDriver.mobile}
                </a>
                <a
                  href={`https://wa.me/${request.selectedDriver.mobile.replace(/\D/g, "").replace(/^0/, "966")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mr-auto text-xs font-black px-4 py-2 rounded-full flex items-center gap-1.5"
                  style={{ backgroundColor: "#25D366", color: "#fff", boxShadow: "0 2px 12px rgba(37,211,102,0.3)" }}
                >
                  <MessageCircle size={12} /> واتساب
                </a>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-white">
              السائقون المقبِلون {offers ? `(${offers.length})` : ""}
            </h2>
            {canChat && (
              <button onClick={() => setShowChat(!showChat)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors"
                style={showChat
                  ? { backgroundColor: "rgba(222,255,154,0.1)", color: "#deff9a", border: "1px solid rgba(222,255,154,0.2)" }
                  : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <MessageCircle size={14} /> {showChat ? "إخفاء" : "المحادثة"}
              </button>
            )}
          </div>

          {showChat && canChat && (
            <div className="mb-6 rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#1a1a1a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <MessageCircle size={15} style={{ color: "#deff9a" }} />
                  <span className="font-black text-sm" style={{ color: "#deff9a" }}>محادثة مع السائق</span>
                </div>
                <button onClick={() => setShowChat(false)} style={{ color: "rgba(255,255,255,0.35)" }}><X size={14} /></button>
              </div>
              <div className="max-h-72 overflow-y-auto p-3 space-y-2" style={{ backgroundColor: "#0d0d0d" }} dir="rtl">
                {(!chatMessages || chatMessages.length === 0) && (
                  <p className="text-center text-xs py-6 font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>لا توجد رسائل بعد. ابدأ المحادثة!</p>
                )}
                {chatMessages?.map((msg) => {
                  const isMe = msg.senderRole === "client";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                        style={isMe
                          ? { backgroundColor: "#deff9a", color: "#0a0a0a" }
                          : { backgroundColor: "#1e1e1e", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {!isMe && <p className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{msg.senderRole === "admin" ? "الإدارة" : "السائق"}</p>}
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

          {loadingOffers && <div className="text-center py-8 text-sm font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>جاري التحميل...</div>}

          {!loadingOffers && (!offers || offers.length === 0) && (
            <div className="text-center py-12 rounded-3xl" style={{ backgroundColor: "#111111", border: "2px dashed rgba(255,255,255,0.08)" }}>
              <p className="text-3xl mb-2">⏳</p>
              <p className="font-black text-white">لا يوجد سائقون قبلوا بعد</p>
              <p className="text-sm font-bold mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>ستظهر أسماء السائقين هنا عند قبولهم طلبك</p>
            </div>
          )}

          <div className="space-y-3">
            {(offers ?? []).map((offer: Offer) => {
              const isSelected = request.selectedDriverId === offer.driverId;
              return (
                <div key={offer.id} className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: "#111111", border: `1px solid ${isSelected ? "rgba(222,255,154,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                  {isSelected && (
                    <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(222,255,154,0.08)", borderBottom: "1px solid rgba(222,255,154,0.15)" }}>
                      <CheckCircle size={14} style={{ color: "#deff9a" }} />
                      <span className="text-xs font-bold" style={{ color: "#deff9a" }}>السائق المؤكَّد</span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                          style={{ backgroundColor: "rgba(222,255,154,0.1)", color: "#deff9a" }}>
                          {offer.driver?.name?.charAt(0) ?? "س"}
                        </div>
                        <div>
                          <p className="font-black text-white">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                          {offer.driver?.carType && <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{offer.driver.carType}</p>}
                        </div>
                      </div>
                      {isOpen && !request.selectedDriverId && (
                        <button
                          onClick={() => handleSelect(offer.id)}
                          disabled={selectOffer.isPending}
                          className="px-4 py-2.5 rounded-xl font-black text-sm active:scale-95 transition-transform disabled:opacity-50"
                          style={{ backgroundColor: "#deff9a", color: "#0a0a0a" }}
                        >
                          تأكيد السائق
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
