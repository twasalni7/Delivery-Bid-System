import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useGetRequest, useGetRequestOffers, useSelectOffer, getGetRequestQueryKey, getGetRequestOffersQueryKey, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ArrowRight, Phone, MapPin, Clock, Users, Calendar, CheckCircle, MessageCircle, Send, X, Star, AlertCircle, Pencil, Ban, Archive } from "lucide-react";
import type { Offer } from "@workspace/api-client-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h, formatTime12hLong } from "@/lib/time-utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp-utils";
import { hasArchivedTimestamp } from "@/lib/request-archive-utils";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

type Message = { id: number; senderRole: string; senderId: number; body: string; createdAt: string };

/** Confirmation dialog shown before finalizing a driver selection */
function DriverConfirmDialog({
  offer,
  onConfirm,
  onCancel,
  isPending,
}: {
  offer: Offer;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5" style={{ backgroundColor: "var(--brand-subtle)", borderBottom: "1px solid var(--brand-border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-black"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
              {offer.driver?.name?.charAt(0) ?? "س"}
            </div>
            <div>
              <p className="font-black text-lg leading-tight" style={{ color: "var(--text)" }}>{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
              {offer.driver?.carType && (
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{offer.driver.carType}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
            <AlertCircle size={15} style={{ color: "var(--brand)" }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>هل أنت متأكد من اختيار هذا السائق؟</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-2">
          <p className="text-sm font-bold text-center" style={{ color: "var(--text-muted)" }}>
            بعد التأكيد سيتم إخطار السائق وإغلاق الطلب أمام السائقين الآخرين
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="py-3.5 rounded-2xl font-black text-sm transition-colors"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
          >
            لا، رجوع
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
          >
            {isPending ? "جاري التأكيد..." : (
              <><CheckCircle size={15} /> نعم، تأكيد</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_GRADIENT: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:      { bg: "var(--status-open-bg)",      border: "var(--status-open-border)",      text: "var(--status-open-text)" },
  SELECTED:  { bg: "var(--status-selected-bg)",  border: "var(--status-selected-border)",  text: "var(--status-selected-text)" },
  ACTIVE:    { bg: "var(--status-active-bg)",    border: "var(--status-active-border)",    text: "var(--status-active-text)" },
  COMPLETED: { bg: "var(--status-completed-bg)", border: "var(--status-completed-border)", text: "var(--status-completed-text)" },
  CANCELLED: { bg: "var(--status-cancelled-bg)", border: "var(--status-cancelled-border)", text: "var(--status-cancelled-text)" },
  EXPIRED:   { bg: "var(--status-expired-bg)",   border: "var(--status-expired-border)",   text: "var(--status-expired-text)" },
  FROZEN:    { bg: "var(--status-frozen-bg)",    border: "var(--status-frozen-border)",    text: "var(--status-frozen-text)" },
};

export default function RequestDetails() {
  const [, params] = useRoute("/client/request/:id");
  const id = parseInt((params as { id: string } | null)?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [confirmOffer, setConfirmOffer] = useState<Offer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    homeLocation: "",
    workLocation: "",
    morningTime: "",
    eveningTime: "",
    numberOfPeople: 1,
    workingDaysPerWeek: 5,
    phone: "",
    notes: "",
  });

  const { data: request, isLoading: loadingReq } = useGetRequest(id, {
    query: { queryKey: getGetRequestQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });
  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(id, {
    query: { queryKey: getGetRequestOffersQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });

  // Real-time: refresh when this request's status changes or a new offer arrives
  useRealtimeRefresh(
    `request-details-${id}`,
    [
      { table: "requests", events: ["UPDATE"] },
      { table: "offers", events: ["INSERT", "UPDATE"] },
    ],
    [getGetRequestQueryKey(id), getGetRequestOffersQueryKey(id)],
    !!id
  );

  const canChat = request && (request.status === "SELECTED" || request.status === "ACTIVE");

  const { data: chatMessages } = useQuery<Message[]>({
    queryKey: ["messages", id],
    queryFn: async () => {
      const res = await fetch(`${API}/api/messages/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل جلب الرسائل");
      return res.json();
    },
    enabled: !!id && showChat,
    refetchInterval: 5_000,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/messages/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

  const editRequest = useMutation({
    mutationFn: async () => {
      const payload = {
        homeLocation: editForm.homeLocation.trim(),
        workLocation: editForm.workLocation.trim(),
        morningTime: editForm.morningTime,
        eveningTime: editForm.eveningTime || undefined,
        numberOfPeople: editForm.numberOfPeople,
        workingDaysPerWeek: editForm.workingDaysPerWeek,
        phone: editForm.phone.trim(),
        notes: editForm.notes.trim() || undefined,
      };
      const res = await fetch(`${API}/api/requests/${id}/client`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "فشل تعديل الطلب");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      setIsEditing(false);
      toast({ title: "تم تعديل الطلب بنجاح" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const cancelRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/requests/${id}/cancel`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "فشل إلغاء الطلب");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      toast({ title: "تم إلغاء الطلب" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const archiveRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/requests/${id}/archive`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "فشل أرشفة الطلب");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      toast({ title: "تمت أرشفة الطلب بنجاح" });
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

  useEffect(() => {
    if (!request) return;
    setEditForm({
      homeLocation: request.homeLocation ?? "",
      workLocation: request.workLocation ?? "",
      morningTime: request.morningTime ?? "",
      eveningTime: request.eveningTime ?? "",
      numberOfPeople: request.numberOfPeople ?? 1,
      workingDaysPerWeek: request.workingDaysPerWeek ?? 5,
      phone: request.phone ?? "",
      notes: ((request as any).notes as string | null | undefined) ?? "",
    });
  }, [request]);

  const selectOffer = useSelectOffer();

  const handleSelect = (offerId: number) => {
    selectOffer.mutate(
      { id, data: { offerId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
          toast({ title: "تم تأكيد السائق بنجاح!" });
          setConfirmOffer(null);
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل الاختيار", variant: "destructive" });
          setConfirmOffer(null);
        },
      }
    );
  };

  if (loadingReq) {
    return <Layout role="client"><div className="text-center py-20 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold text-lg" style={{ color: "var(--text)" }}>الطلب غير موجود</p>
          <Link href="/client">
            <div className="mt-4 inline-block px-5 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>العودة</div>
          </Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";
  const canModify = (request.status === "OPEN" || request.status === "FROZEN") && !request.selectedDriverId;
  const statusStyle = STATUS_GRADIENT[request.status] ?? STATUS_GRADIENT.OPEN;
  const shifts = (request as any).shifts as Array<{ label?: string; goTime: string; returnTime?: string }> | null | undefined;
  const additionalLocations = (request as any).additionalLocations as Array<{ type: string; address: string }> | null | undefined;
  const notes = (request as any).notes as string | null | undefined;

  return (
    <Layout role="client">
      <div dir="rtl" className="pb-6">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm font-bold transition-colors mb-5"
          style={{ color: "var(--text-muted)" }}>
          <ArrowRight size={14} /> العودة
        </Link>

        {/* Request Summary Card */}
        <div className="rounded-3xl overflow-hidden mb-6" style={{ backgroundColor: "var(--surface)", border: `1px solid ${statusStyle.border}` }}>
          <div className="p-5" style={{ backgroundColor: statusStyle.bg, borderBottom: `1px solid ${statusStyle.border}` }}>
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs font-black px-3 py-1 rounded-full"
                style={{ backgroundColor: statusStyle.border, color: statusStyle.text }}>
                {getStatusLabel(request.status)}
              </span>
              <span className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>طلب #{request.id}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>من</p>
                  <p className="font-black text-sm" style={{ color: "var(--text)" }}>{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "var(--status-cancelled-text)" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>إلى</p>
                  <p className="font-black text-sm" style={{ color: "var(--text)" }}>{request.workLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                  <Clock size={13} />
                  {shifts && shifts.length > 0 ? (
                    <div className="space-y-1.5 mt-1 flex-1">
                      {shifts.map((s, i) => (
                        <div key={i} className="px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                          <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>{s.label ?? `الوردية ${i + 1}`}</p>
                          <p className="text-xs font-bold" dir="ltr" style={{ color: "var(--text)" }}>الذهاب: {formatTime12hLong(s.goTime ?? "")}</p>
                          {s.returnTime && <p className="text-xs font-bold" dir="ltr" style={{ color: "var(--text)" }}>العودة: {formatTime12hLong(s.returnTime)}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <span dir="ltr">الذهاب: {formatTime12h(request.morningTime)}</span>
                      {request.eveningTime && <span dir="ltr"> | العودة: {formatTime12h(request.eveningTime)}</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                  <Users size={13} />
                  <span>{request.numberOfPeople} {request.numberOfPeople === 1 ? "شخص" : "أشخاص"}</span>
                </div>
              </div>
              {additionalLocations && additionalLocations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {additionalLocations.map((loc, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <MapPin size={11} className="shrink-0 mt-0.5" style={{ color: "var(--text-hint)" }} />
                      <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{loc.type === "pickup" ? "استلام إضافي" : "توصيل إضافي"}: {loc.address}</p>
                    </div>
                  ))}
                </div>
              )}
              {notes && (
                <p className="text-xs mt-2 font-bold" style={{ color: "var(--text-muted)" }}>📝 {notes}</p>
              )}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={13} style={{ color: "var(--text-hint)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{request.workingDaysPerWeek} أيام/أسبوع</span>
              </div>
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-hint)" }}>Price per person</p>
                <p className="text-lg font-black" style={{ color: "var(--brand)" }} dir="ltr">
                  {request.monthlyPrice != null && request.numberOfPeople > 0
                    ? (request.monthlyPrice / request.numberOfPeople).toFixed(0)
                    : (request.monthlyPrice?.toFixed(0) ?? "—")}{" "}
                  <span className="text-xs font-normal" style={{ color: "var(--brand)" }}>SAR</span>
                </p>
                {request.numberOfPeople > 1 && request.monthlyPrice != null && (
                  <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
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
                      ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                      : { backgroundColor: "var(--border-subtle)", color: "var(--text-hint)" }}>
                    {d}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {canModify && (
          <div className="rounded-3xl p-4 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setIsEditing((prev) => !prev)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1.5"
                style={{ backgroundColor: "var(--border-subtle)", color: "var(--text)" }}
              >
                <Pencil size={14} /> {isEditing ? "إغلاق التعديل" : "تعديل الطلب"}
              </button>
              <button
                onClick={() => cancelRequest.mutate()}
                disabled={cancelRequest.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)" }}
              >
                <Ban size={14} /> {cancelRequest.isPending ? "جارٍ الإلغاء..." : "إلغاء الطلب"}
              </button>
            </div>

            {isEditing && (
              <div className="space-y-2.5">
                <input
                  value={editForm.homeLocation}
                  onChange={(e) => setEditForm((p) => ({ ...p, homeLocation: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  placeholder="موقع الانطلاق"
                />
                <input
                  value={editForm.workLocation}
                  onChange={(e) => setEditForm((p) => ({ ...p, workLocation: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  placeholder="موقع الوصول"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={editForm.morningTime}
                    onChange={(e) => setEditForm((p) => ({ ...p, morningTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                  <input
                    type="time"
                    value={editForm.eveningTime}
                    onChange={(e) => setEditForm((p) => ({ ...p, eveningTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={editForm.numberOfPeople}
                    onChange={(e) => setEditForm((p) => ({ ...p, numberOfPeople: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    placeholder="عدد الأشخاص"
                  />
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={editForm.workingDaysPerWeek}
                    onChange={(e) => setEditForm((p) => ({ ...p, workingDaysPerWeek: Math.min(7, Math.max(1, Number(e.target.value) || 1)) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    placeholder="أيام العمل/الأسبوع"
                  />
                </div>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  placeholder="رقم الجوال"
                />
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm min-h-[88px]"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  placeholder="ملاحظات"
                />
                <button
                  onClick={() => editRequest.mutate()}
                  disabled={editRequest.isPending}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-black disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  {editRequest.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            )}
          </div>
        )}

        {!hasArchivedTimestamp(request) && (
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => archiveRequest.mutate()}
              disabled={archiveRequest.isPending}
              className="w-full px-4 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
            >
              <Archive size={14} />
              {archiveRequest.isPending ? "جارٍ الأرشفة..." : "أرشفة الطلب"}
            </button>
          </div>
        )}

        {request.selectedDriver && (request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED") && (
          <div className="rounded-3xl overflow-hidden mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--brand-border)" }}>
            <div className="p-5" style={{ backgroundColor: "var(--brand-subtle)", borderBottom: "1px solid var(--brand-border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} style={{ color: "var(--brand)" }} />
                <span className="font-bold" style={{ color: "var(--brand)" }}>
                  {request.status === "COMPLETED" ? "تمت الاتفاقية" : "تم اختيار السائق"}
                </span>
              </div>
              <p className="text-2xl font-black" style={{ color: "var(--text)" }}>{request.selectedDriver.name}</p>
              {request.selectedDriver.carType && (
                <p className="text-xs font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>{request.selectedDriver.carType}</p>
              )}
            </div>
            {request.selectedDriver.mobile && (
              <div className="px-5 py-4 flex items-center gap-3">
                <Phone size={14} style={{ color: "var(--status-active-text)" }} />
                <a href={`tel:${request.selectedDriver.mobile}`} className="text-sm font-bold" style={{ color: "var(--text)" }} dir="ltr">
                  {request.selectedDriver.mobile}
                </a>
                <a
                  href={buildWhatsAppUrl(request.selectedDriver.mobile.replace(/\D/g, "").replace(/^0/, "966"))}
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
            <h2 className="text-lg font-black" style={{ color: "var(--text)" }}>
              السائقون المقبِلون {offers ? `(${offers.length})` : ""}
            </h2>
            {canChat && (
              <button onClick={() => setShowChat(!showChat)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors"
                style={showChat
                  ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                  : { backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border-subtle)" }}>
                <MessageCircle size={14} /> {showChat ? "إخفاء" : "المحادثة"}
              </button>
            )}
          </div>

          {showChat && canChat && (
            <div className="mb-6 rounded-3xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <MessageCircle size={15} style={{ color: "var(--brand)" }} />
                  <span className="font-black text-sm" style={{ color: "var(--brand)" }}>محادثة مع السائق</span>
                </div>
                <button onClick={() => setShowChat(false)} style={{ color: "var(--text-hint)" }}><X size={14} /></button>
              </div>
              <div className="max-h-72 overflow-y-auto p-3 space-y-2" style={{ backgroundColor: "var(--header-bg)" }} dir="rtl">
                {(!chatMessages || chatMessages.length === 0) && (
                  <p className="text-center text-xs py-6 font-bold" style={{ color: "var(--text-hint)" }}>لا توجد رسائل بعد. ابدأ المحادثة!</p>
                )}
                {chatMessages?.map((msg) => {
                  const isMe = msg.senderRole === "client";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                        style={isMe
                          ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                          : { backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                        {!isMe && <p className="text-[10px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>{msg.senderRole === "admin" ? "الإدارة" : "السائق"}</p>}
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

          {loadingOffers && <div className="text-center py-8 text-sm font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div>}

          {!loadingOffers && (!offers || offers.length === 0) && (
            <div className="text-center py-12 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
              <p className="text-3xl mb-2">⏳</p>
              <p className="font-black" style={{ color: "var(--text)" }}>لا يوجد سائقون قبلوا بعد</p>
              <p className="text-sm font-bold mt-1" style={{ color: "var(--text-hint)" }}>ستظهر أسماء السائقين هنا عند قبولهم طلبك</p>
            </div>
          )}

          <div className="space-y-3">
            {(offers ?? []).map((offer: Offer) => {
              const isSelected = request.selectedDriverId === offer.driverId;
              return (
                <div key={offer.id} className="rounded-2xl overflow-hidden transition-all"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: `1px solid ${isSelected ? "var(--brand-border)" : "var(--border-subtle)"}`,
                    boxShadow: isSelected ? "0 0 0 2px var(--brand-border)" : undefined,
                  }}>
                  {isSelected && (
                    <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--brand-subtle)", borderBottom: "1px solid var(--brand-border)" }}>
                      <CheckCircle size={14} style={{ color: "var(--brand)" }} />
                      <span className="text-xs font-bold" style={{ color: "var(--brand)" }}>السائق المؤكَّد</span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-black shrink-0"
                        style={{ backgroundColor: isSelected ? "var(--brand)" : "var(--brand-subtle)", color: isSelected ? "var(--brand-fg)" : "var(--brand)" }}>
                        {offer.driver?.name?.charAt(0) ?? "س"}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-base" style={{ color: "var(--text)" }}>{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {offer.driver?.carType && (
                            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{offer.driver.carType}</span>
                          )}
                          {offer.driver?.nationality && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-hint)" }}>
                              {offer.driver.nationality}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action */}
                      {isOpen && !request.selectedDriverId && (
                        <button
                          onClick={() => setConfirmOffer(offer)}
                          className="px-4 py-2.5 rounded-xl font-black text-sm active:scale-95 transition-transform"
                          style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                        >
                          اختيار
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

      {/* Driver confirmation dialog */}
      {confirmOffer && (
        <DriverConfirmDialog
          offer={confirmOffer}
          onConfirm={() => handleSelect(confirmOffer.id)}
          onCancel={() => setConfirmOffer(null)}
          isPending={selectOffer.isPending}
        />
      )}
    </Layout>
  );
}
