import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useGetRequest, useGetRequestOffers, getGetRequestQueryKey, getGetRequestOffersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Phone, MapPin, Clock, Users, Calendar, CheckCircle, MessageCircle, Send, X } from "lucide-react";
import type { Offer } from "@workspace/api-client-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { API_ORIGIN as API } from "@/lib/api-config";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

type Message = { id: number; senderRole: string; senderId: number; body: string; createdAt: string };

const STATUS_GRADIENT: Record<string, string> = {
  OPEN:      "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  SELECTED:  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  ACTIVE:    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  COMPLETED: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
  CANCELLED: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  EXPIRED:   "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
  FROZEN:    "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
};

export default function AdminRequestDetails() {
  const [, params] = useRoute("/admin/request/:id");
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

  // Admin select-offer — calls POST /api/admin/requests/:id/select-offer
  const selectOffer = useMutation({
    mutationFn: async (offerId: number) => {
      const res = await fetch(`${API}/api/admin/requests/${id}/select-offer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل اختيار السائق");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
      toast({ title: "✅ تم تأكيد السائق بنجاح!" });
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "فشل الاختيار", variant: "destructive" });
    },
  });

  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!offers || !id) return;
    const currentCount = offers.length;
    if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
      const newCount = currentCount - prevCountRef.current;
      toast({ title: `${newCount} سائق جديد قبل الطلب!`, description: "تحقق من السائقين المقبِلين أدناه." });
    }
    prevCountRef.current = currentCount;
  }, [offers, id, toast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (loadingReq) {
    return <Layout role="admin"><div className="text-center py-20 text-gray-400">جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="admin">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold text-lg text-gray-700">الطلب غير موجود</p>
          <Link href="/admin/requests">
            <div className="mt-4 inline-block px-5 py-2 rounded-full bg-violet-600 text-white font-bold text-sm">العودة</div>
          </Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";
  const gradient = STATUS_GRADIENT[request.status] ?? STATUS_GRADIENT.OPEN;
  const shifts = (request as any).shifts as Array<{ label?: string; goTime: string; returnTime?: string }> | null | undefined;
  const additionalLocations = (request as any).additionalLocations as Array<{ type: string; address: string }> | null | undefined;
  const notes = (request as any).notes as string | null | undefined;

  return (
    <Layout role="admin">
      <div dir="rtl" className="pb-6">
        <Link href="/admin/requests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
          <ArrowRight size={14} /> العودة للطلبات
        </Link>

        {/* Badge for admin-created requests */}
        {(request as any).createdBy === "admin" && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-black mb-3">
            🛡️ طلب منشأ من الإدارة
          </div>
        )}

        <div className="rounded-2xl overflow-hidden shadow-md mb-5">
          <div className="p-5 text-white" style={{ background: gradient }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                {getStatusLabel(request.status)}
              </span>
              <span className="text-white/60 text-xs">طلب #{request.id}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-white/80 text-sm mt-0.5">📍</span>
                <div>
                  <p className="text-white/60 text-xs">من</p>
                  <p className="text-white font-bold text-sm">{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-white/80 text-sm mt-0.5">📍</span>
                <div>
                  <p className="text-white/60 text-xs">إلى</p>
                  <p className="text-white font-bold text-sm">{request.workLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-white/80 text-sm">
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
                <div className="flex items-center gap-1.5 text-white/80 text-sm">
                  <Users size={13} />
                  <span>{request.numberOfPeople} {request.numberOfPeople === 1 ? "شخص" : "أشخاص"}</span>
                </div>
              </div>
              {additionalLocations && additionalLocations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {additionalLocations.map((loc, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <MapPin size={11} className="text-white/60 mt-0.5 shrink-0" />
                      <p className="text-white/70 text-xs">{loc.type === "pickup" ? "استلام إضافي" : "توصيل إضافي"}: {loc.address}</p>
                    </div>
                  ))}
                </div>
              )}
              {notes && (
                <p className="text-white/60 text-xs mt-2">📝 {notes}</p>
              )}
            </div>
          </div>

          <div className="bg-white px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">{request.workingDaysPerWeek} أيام/أسبوع</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">السعر الشهري</p>
                <p className="text-lg font-black text-blue-700" dir="ltr">
                  {request.monthlyPrice?.toFixed(0) ?? "—"} <span className="text-xs font-normal text-gray-400">ر.س</span>
                </p>
              </div>
            </div>
            {/* Full phone always shown for admin */}
            {request.phone && (
              <div className="flex items-center gap-2 mb-2">
                <Phone size={13} className="text-gray-400" />
                <a href={`tel:${request.phone}`} className="text-sm font-bold text-gray-700" dir="ltr">{request.phone}</a>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_AR.map((d, i) => {
                const active = i < (request.workingDaysPerWeek ?? 5);
                return (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                    {d}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {request.selectedDriver && (request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED") && (
          <div className="rounded-2xl overflow-hidden shadow-md mb-5">
            <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} />
                <span className="font-bold">
                  {request.status === "COMPLETED" ? "تمت الاتفاقية" : "تم اختيار السائق"}
                </span>
              </div>
              <p className="text-2xl font-black">{request.selectedDriver.name}</p>
              {request.selectedDriver.carType && (
                <p className="text-white/70 text-xs mt-0.5">{request.selectedDriver.carType}</p>
              )}
            </div>
            {request.selectedDriver.mobile && (
              <div className="bg-white px-4 py-3 flex items-center gap-3">
                <Phone size={14} className="text-green-600" />
                <a href={`tel:${request.selectedDriver.mobile}`} className="text-sm font-bold text-gray-800" dir="ltr">
                  {request.selectedDriver.mobile}
                </a>
                <a
                  href={`https://wa.me/${request.selectedDriver.mobile.replace(/\D/g, "").replace(/^0/, "966")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mr-auto bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <MessageCircle size={11} /> واتساب
                </a>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-gray-900">
              السائقون المقبِلون {offers ? `(${offers.length})` : ""}
            </h2>
            {canChat && (
              <button onClick={() => setShowChat(!showChat)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                <MessageCircle size={14} /> {showChat ? "إخفاء" : "المحادثة"}
              </button>
            )}
          </div>

          {showChat && canChat && (
            <div className="mb-5 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={15} className="text-white" />
                  <span className="text-white font-black text-sm">محادثة مع السائق</span>
                </div>
                <button onClick={() => setShowChat(false)} className="text-white/70 hover:text-white"><X size={14} /></button>
              </div>
              <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-gray-50" dir="rtl">
                {(!chatMessages || chatMessages.length === 0) && (
                  <p className="text-center text-xs text-gray-400 py-6">لا توجد رسائل بعد. ابدأ المحادثة!</p>
                )}
                {chatMessages?.map((msg) => {
                  const isMe = msg.senderRole === "admin";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMe ? "text-white" : "bg-white border border-gray-200 text-gray-700"}`}
                        style={isMe ? { background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" } : {}}
                      >
                        {!isMe && <p className="text-[10px] font-bold text-gray-400 mb-0.5">{msg.senderRole === "client" ? "العميل" : "السائق"}</p>}
                        <p>{msg.body}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-gray-200 p-2 flex gap-2 bg-white">
                <input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) { e.preventDefault(); sendMessage.mutate(); } }}
                  placeholder="اكتب رسالة..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  dir="rtl"
                />
                <button
                  onClick={() => { if (chatMessage.trim()) sendMessage.mutate(); }}
                  disabled={!chatMessage.trim() || sendMessage.isPending}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {loadingOffers && <div className="text-center py-8 text-gray-400 text-sm">جاري التحميل...</div>}

          {!loadingOffers && (!offers || offers.length === 0) && (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <p className="text-3xl mb-2">⏳</p>
              <p className="font-bold text-gray-700">لا يوجد سائقون قبلوا بعد</p>
              <p className="text-gray-400 text-sm mt-1">ستظهر أسماء السائقين هنا عند قبولهم الطلب</p>
            </div>
          )}

          <div className="space-y-3">
            {(offers ?? []).map((offer: Offer) => {
              const isSelected = request.selectedDriverId === offer.driverId;
              return (
                <div key={offer.id} className={`rounded-2xl overflow-hidden shadow-sm ${isSelected ? "shadow-md" : ""}`}>
                  {isSelected && (
                    <div className="px-4 py-2 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                      <CheckCircle size={14} className="text-white" />
                      <span className="text-white text-xs font-bold">السائق المؤكَّد</span>
                    </div>
                  )}
                  <div className="bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-black text-violet-600">
                          {offer.driver?.name?.charAt(0) ?? "س"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                          {offer.driver?.carType && <p className="text-xs text-gray-400">{offer.driver.carType}</p>}
                          {/* Admin always sees driver mobile */}
                          {(offer.driver as any)?.mobile && (
                            <a href={`tel:${(offer.driver as any).mobile}`} className="text-xs text-blue-500 font-medium" dir="ltr">
                              {(offer.driver as any).mobile}
                            </a>
                          )}
                        </div>
                      </div>
                      {isOpen && !request.selectedDriverId && (
                        <button
                          onClick={() => selectOffer.mutate(offer.id)}
                          disabled={selectOffer.isPending}
                          className="px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                        >
                          {selectOffer.isPending ? "جاري..." : "تأكيد السائق"}
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
