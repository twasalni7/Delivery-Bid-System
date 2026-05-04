import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/time-utils";
import { haversineKm } from "@/lib/pricing";
import MapPicker, { type MapCoords } from "@/components/MapPicker";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import {
  ArrowRight, Plus, X, Home, Briefcase, Users, Clock,
  CheckCircle2, Check, AlertTriangle, Navigation, Share2, Lock,
} from "lucide-react";

const CLIENT_TYPES = [
  { value: "موظفات", emoji: "👩‍💼", label: "موظفات" },
  { value: "طلاب",   emoji: "🎓",   label: "طلاب مدارس" },
  { value: "معلمات", emoji: "📚",   label: "معلمات" },
  { value: "جامعات", emoji: "🎓",   label: "طلاب جامعة" },
  { value: "مدارس",  emoji: "🏫",   label: "مدارس" },
  { value: "غيره",   emoji: "📦",   label: "غيره" },
];

const DAYS = [
  { key: "sun", label: "أح" },
  { key: "mon", label: "إث" },
  { key: "tue", label: "ثل" },
  { key: "wed", label: "أر" },
  { key: "thu", label: "خم" },
  { key: "fri", label: "ج" },
  { key: "sat", label: "س" },
];

type AdditionalLocation = { type: "pickup" | "dropoff"; address: string; lat?: number; lng?: number };

/* ── Progress Steps Bar ── */
function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex justify-between items-center px-8 mb-8 relative">
      <div className="absolute left-8 right-8 h-1 top-1/2 -translate-y-1/2 -z-10 rounded-full" style={{ backgroundColor: "var(--border-subtle)" }} />
      <div
        className="absolute right-8 h-1 top-1/2 -translate-y-1/2 -z-10 transition-all duration-700 rounded-full"
        style={{ backgroundColor: "var(--brand)", left: "2rem", width: `${((currentStep - 1) / 3) * 100}%` }}
      />
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className="w-5 h-5 rounded-full border-4 transition-all duration-500 shadow-md z-10"
          style={s <= currentStep ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" } : { backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        />
      ))}
    </div>
  );
}

const STEP_TITLES = ["نوع الاشتراك", "تحديد المسار", "الجدول والوقت", "التفاصيل المالية"];

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(1);

  // Step 1
  const [clientType, setClientType] = useState("موظفات");

  // Step 2
  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [homeCoords, setHomeCoords] = useState<MapCoords | null>(null);
  const [workCoords, setWorkCoords] = useState<MapCoords | null>(null);
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);

  // Step 3
  const [morningTime, setMorningTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [selectedDays, setSelectedDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);
  const [notes, setNotes] = useState("");

  // Step 4
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  // Shared subscription state
  const [sharedSuggestions, setSharedSuggestions] = useState<{ count: number } | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<"private" | "shared">("private");

  // Pricing result fetched from server
  const [pricingResult, setPricingResult] = useState<{
    pricePerPerson: number;
    price: number;
    needsAdminReview: boolean;
    distanceKm: number;
    numberOfPeople: number;
  } | undefined>(undefined);

  // Distance calculated from selected coordinates — sums all route segments
  const distanceKm = (() => {
    if (!homeCoords || !workCoords) return undefined;
    const coordStops = additionalLocations
      .filter((l) => l.lat != null && l.lng != null)
      .map((l) => ({ lat: l.lat!, lng: l.lng! }));
    const points: { lat: number; lng: number }[] = [homeCoords, ...coordStops, workCoords];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      total += haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    }
    return total;
  })();

  // Number of people for pricing: for shared subscription, add suggestion count to household
  const sharingCount =
    subscriptionType === "shared" && sharedSuggestions && sharedSuggestions.count > 0
      ? Math.min(parseInt(numberOfPeople) + sharedSuggestions.count, 4)
      : parseInt(numberOfPeople) || 1;

  // Fetch price from server whenever distance or passengers change
  useEffect(() => {
    if (distanceKm === undefined) {
      setPricingResult(undefined);
      return;
    }
    fetch(`${API}/api/pricing/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ distanceKm, numberOfPeople: sharingCount }),
    })
      .then((r) => { if (!r.ok) throw new Error(`pricing: ${r.status}`); return r.json(); })
      .then((data) => setPricingResult(data))
      .catch(() => setPricingResult(undefined));
  }, [distanceKm, sharingCount]);

  // Fetch shared subscription suggestions whenever coordinates + time are set
  const fetchSuggestions = useCallback(() => {
    if (!homeCoords || !workCoords) return;
    const params = new URLSearchParams({
      homeLat: String(homeCoords.lat),
      homeLng: String(homeCoords.lng),
      destLat: String(workCoords.lat),
      destLng: String(workCoords.lng),
      ...(morningTime ? { morningTime } : {}),
    });
    fetch(`${API}/api/pricing/suggestions?${params}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === "number") setSharedSuggestions({ count: d.count }); })
      .catch(() => {});
  }, [homeCoords, workCoords, morningTime]);

  useEffect(() => {
    if (step === 4 && homeCoords && workCoords) {
      fetchSuggestions();
    }
  }, [step, fetchSuggestions]);

  const toggleDay = (key: string) =>
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );

  const addLocation = () =>
    setAdditionalLocations((prev) => [...prev, { type: "pickup", address: "" }]);
  const removeLocation = (idx: number) =>
    setAdditionalLocations((prev) => prev.filter((_, i) => i !== idx));
  const updateLocation = (idx: number, patch: Partial<AdditionalLocation>) =>
    setAdditionalLocations((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );

  const canNext = () => {
    if (step === 1) return !!clientType;
    if (step === 2) return homeLocation.trim() && workLocation.trim();
    if (step === 3) return morningTime && selectedDays.length > 0;
    return phone.trim().length >= 10;
  };

  const handleSubmit = () => {
    const validAdditional = additionalLocations.filter((l) => l.address.trim());
    // Build notes: include sharing preference if applicable
    const sharingNote = subscriptionType === "shared" && sharedSuggestions && sharedSuggestions.count > 0
      ? `[اشتراك مشترك - ${sharingCount} أشخاص]`
      : null;
    const finalNotes = [sharingNote, notes.trim()].filter(Boolean).join(" — ") || undefined;

    // Build stops array for accurate multi-point distance on the server
    const stopsForSubmit: { stopOrder: number; lat: number; lng: number; address: string; stopType: string }[] = [];
    let stopOrder = 0;
    if (homeCoords) stopsForSubmit.push({ stopOrder: stopOrder++, lat: homeCoords.lat, lng: homeCoords.lng, address: homeCoords.address, stopType: "origin" });
    for (const loc of validAdditional) {
      if (loc.lat != null && loc.lng != null) {
        stopsForSubmit.push({ stopOrder: stopOrder++, lat: loc.lat, lng: loc.lng, address: loc.address, stopType: loc.type });
      }
    }
    if (workCoords) stopsForSubmit.push({ stopOrder: stopOrder++, lat: workCoords.lat, lng: workCoords.lng, address: workCoords.address, stopType: "destination" });

    createRequest.mutate(
      {
        data: {
          clientType: clientType as any,
          homeLocation: homeCoords?.address || homeLocation.trim(),
          workLocation: workCoords?.address || workLocation.trim(),
          homeLat: homeCoords?.lat,
          homeLng: homeCoords?.lng,
          destLat: workCoords?.lat,
          destLng: workCoords?.lng,
          distanceKm,
          additionalLocations: validAdditional.length > 0 ? validAdditional : undefined,
          phone: phone.trim(),
          numberOfPeople: sharingCount,
          workingDaysPerWeek: selectedDays.length,
          numberOfShifts: eveningTime ? 2 : 1,
          morningTime,
          eveningTime: eveningTime || undefined,
          notes: finalNotes,
          // monthlyPrice is intentionally not sent — the server calculates
          // it from coordinates using the DB pricing config to prevent
          // client-side price manipulation.
          stops: stopsForSubmit.length > 2 ? stopsForSubmit : undefined,
        } as any,
      },
      {
        onSuccess: (req) => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم إضافة الطلب!", description: `طلب رقم #${req.id} مفتوح الآن.` });
          setLocation(`/client/request/${req.id}`);
        },
        onError: (err: Error) => {
          toast({ title: err.message || "فشل إضافة الطلب", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="client">
      <div dir="rtl" className="pb-8">
        <Link href="/client" className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors mb-6" style={{ color: "var(--text-muted)" }}>
          <ArrowRight size={15} /> العودة لاشتراكاتي
        </Link>

        <ProgressSteps currentStep={step} />

        <div className="rounded-[2.5rem] overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 24px 56px rgba(0,0,0,0.4)" }}>
          {/* Step header */}
          <div className="text-center px-8 pt-8 pb-6" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "var(--text-hint)" }}>المرحلة {step} من 4</p>
            <h2 className="text-[1.8rem] font-black tracking-tight leading-none text-white">{STEP_TITLES[step - 1]}</h2>
          </div>

          <div className="p-6 space-y-5">
            {/* ── Step 1: Subscription type ── */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3">
                {CLIENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setClientType(t.value)}
                    className="flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all active:scale-[0.98]"
                    style={clientType === t.value ? { borderColor: "var(--brand-border)", backgroundColor: "var(--brand-subtle)" } : { borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                          style={clientType === t.value ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "var(--border-subtle)" }}
                        >
                          {clientType === t.value ? (
                          <Users size={22} />
                          ) : (
                            <span>{t.emoji}</span>
                          )}
                        </div>
                        <span className="text-[1.1rem] font-black text-white">{t.label}</span>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        style={clientType === t.value ? { borderColor: "var(--brand)", backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { borderColor: "var(--border)" }}
                      >
                        {clientType === t.value && <Check size={12} strokeWidth={4} />}
                      </div>
                    </button>
                ))}
              </div>
            )}

            {/* ── Step 2: Route ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>
                    <Home className="inline-block ml-1" size={16} style={{ color: "var(--brand)" }} />
                    موقع الانطلاق (المنزل)
                  </label>
                  <MapPicker
                    value={homeCoords}
                    onChange={(coords) => {
                      setHomeCoords(coords);
                      setHomeLocation(coords.address);
                    }}
                    placeholder="اضغط على الخريطة لتحديد موقع المنزل"
                    color="var(--brand)"
                  />
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] transition-colors mt-2" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
                    <Home className="shrink-0" size={22} style={{ color: "var(--brand)" }} />
                    <Input
                      type="text"
                      placeholder="أو اكتب العنوان يدوياً: حي الروضة، شارع التحلية..."
                      value={homeLocation}
                      onChange={(e) => {
                        setHomeLocation(e.target.value);
                        // Clear coordinates when user manually edits the address
                        // to maintain consistency between text and coordinates
                        if (homeCoords && e.target.value !== homeCoords.address) {
                          setHomeCoords(null);
                        }
                      }}
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-base font-bold p-0 h-auto"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>
                    <Briefcase className="inline-block ml-1 text-rose-500" size={16} />
                    موقع الوصول (الدوام)
                  </label>
                  <MapPicker
                    value={workCoords}
                    onChange={(coords) => {
                      setWorkCoords(coords);
                      setWorkLocation(coords.address);
                    }}
                    placeholder="اضغط على الخريطة لتحديد موقع العمل"
                    color="var(--brand)"
                    initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
                  />
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] transition-colors mt-2" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
                    <Briefcase className="text-rose-500 shrink-0" size={22} />
                    <Input
                      type="text"
                      placeholder="أو اكتب العنوان يدوياً: مستشفى الملك فهد، الرياض..."
                      value={workLocation}
                      onChange={(e) => {
                        setWorkLocation(e.target.value);
                        // Clear coordinates when user manually edits the address
                        // to maintain consistency between text and coordinates
                        if (workCoords && e.target.value !== workCoords.address) {
                          setWorkCoords(null);
                        }
                      }}
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-base font-bold p-0 h-auto"
                    />
                  </div>
                </div>

                {/* Distance indicator */}
                {homeCoords && workCoords && (
                  <div className="p-4 rounded-[1.5rem]" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      {additionalLocations.some((l) => l.lat != null) ? "إجمالي المسافة (جميع المحطات)" : "المسافة المقدرة"}:{" "}
                      <span className="text-white">
                        {distanceKm?.toFixed(1)}{" "}كم
                      </span>
                    </p>
                    {additionalLocations.some((l) => l.lat != null) && (
                      <p className="text-xs font-bold mt-1" style={{ color: "var(--brand)" }}>
                        يشمل {additionalLocations.filter((l) => l.lat != null).length} محطة إضافية
                      </p>
                    )}
                  </div>
                )}

                {additionalLocations.map((loc, idx) => (
                  <div key={idx} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <select
                        value={loc.type}
                        onChange={(e) => updateLocation(idx, { type: e.target.value as "pickup" | "dropoff" })}
                        className="rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none"
                        style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                      >
                        <option value="pickup">استلام إضافي</option>
                        <option value="dropoff">توصيل إضافي</option>
                      </select>
                      <button
                        onClick={() => removeLocation(idx)}
                        className="p-2 rounded-xl transition-colors"
                        style={{ color: "var(--status-cancelled-text)", backgroundColor: "var(--status-cancelled-bg)" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="p-3">
                      <MapPicker
                        value={loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng, address: loc.address } : null}
                        onChange={(coords) => updateLocation(idx, { lat: coords.lat, lng: coords.lng, address: coords.address })}
                        placeholder={loc.type === "pickup" ? "حدد موقع الاستلام الإضافي على الخريطة" : "حدد موقع التوصيل الإضافي على الخريطة"}
                        color={loc.type === "pickup" ? "var(--brand)" : "var(--status-cancelled-text)"}
                        initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addLocation}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-[1.5rem] border-2 border-dashed text-sm font-black transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  <Plus size={16} /> إضافة موقع آخر
                </button>
              </div>
            )}

            {/* ── Step 3: Schedule ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>⏰ وقت الذهاب</label>
                    <Input
                      type="time"
                      value={morningTime}
                      onChange={(e) => setMorningTime(e.target.value)}
                      className="rounded-2xl font-bold text-base input-dark"
                      dir="ltr"
                    />
                    {morningTime && <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>{formatTime12h(morningTime)}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>⏰ وقت العودة</label>
                    <Input
                      type="time"
                      value={eveningTime}
                      onChange={(e) => setEveningTime(e.target.value)}
                      className="rounded-2xl font-bold text-base input-dark"
                      dir="ltr"
                    />
                    {eveningTime && <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>{formatTime12h(eveningTime)}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>أيام العمل</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d) => (
                      <button
                        key={d.key}
                        onClick={() => toggleDay(d.key)}
                        className="w-10 h-10 rounded-full text-sm font-black transition-all active:scale-90"
                        style={selectedDays.includes(d.key) ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{selectedDays.length} أيام في الأسبوع</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>👥 عدد الأشخاص</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setNumberOfPeople((p) => String(Math.max(1, parseInt(p) - 1)))}
                       className="w-10 h-10 rounded-full font-black text-xl transition-colors"
                       style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                     >−</button>
                    <span className="text-[1.8rem] font-black w-10 text-center" style={{ color: "var(--brand)" }}>{numberOfPeople}</span>
                    <button
                      onClick={() => setNumberOfPeople((p) => String(Math.min(20, parseInt(p) + 1)))}
                       className="w-10 h-10 rounded-full font-black text-xl transition-colors"
                       style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                     >+</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>ملاحظات للسائقين (اختياري)</label>
                  <Textarea
                    placeholder="مثال: يفضل سائقة، باص كبير..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="rounded-2xl font-bold resize-none input-dark"
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Financial & Contact ── */}
            {step === 4 && (
              <div className="space-y-5">
                {/* Shared Subscription Suggestion */}
                {sharedSuggestions && sharedSuggestions.count > 0 && (
                  <div className="rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid var(--status-frozen-border)", backgroundColor: "var(--status-frozen-bg)" }}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--status-frozen-bg)" }}>
                          <Share2 size={18} style={{ color: "var(--status-frozen-text)" }} />
                        </div>
                        <div>
                          <p className="font-black text-sm" style={{ color: "var(--text)" }}>اشتراك مشترك متاح!</p>
                          <p className="text-xs" style={{ color: "var(--text-sub)" }}>
                            وُجد {sharedSuggestions.count} {sharedSuggestions.count === 1 ? "شخص" : "أشخاص"} قريبين منك — يمكنكم المشاركة بسعر مخفّض
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSubscriptionType("shared")}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all"
                          style={subscriptionType === "shared"
                            ? { backgroundColor: "var(--status-frozen-text)", color: "var(--brand-fg)" }
                            : { backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)", border: "1px solid var(--status-frozen-border)" }}
                        >
                          <Share2 size={15} /> مشترك (أرخص)
                        </button>
                        <button
                          onClick={() => setSubscriptionType("private")}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all"
                          style={subscriptionType === "private"
                            ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                            : { backgroundColor: "var(--border-subtle)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
                        >
                          <Lock size={15} /> خاص
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-calculated price display */}
                {pricingResult && !pricingResult.needsAdminReview ? (
                  <div className="p-5 rounded-[1.5rem] space-y-3" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري المحسوب تلقائياً</p>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                        <Lock size={10} /> محمي
                      </div>
                    </div>

                    {/* Per-person price — always displayed */}
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-hint)" }}>
                        Price per person
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-[2.5rem] font-black leading-none" style={{ color: "var(--brand)" }}>
                          {pricingResult.pricePerPerson.toLocaleString("ar-SA")}
                        </p>
                        <p className="text-base font-black" style={{ color: "var(--text-muted)" }}>SAR / شخص / شهر</p>
                      </div>
                      {sharingCount > 1 && (
                        <p className="text-sm font-bold" style={{ color: "var(--text-hint)" }}>
                          ({sharingCount} أشخاص × {pricingResult.pricePerPerson.toLocaleString("ar-SA")} = {pricingResult.price.toLocaleString("ar-SA")} ر.س إجمالي)
                        </p>
                      )}
                    </div>

                    {/* Pricing breakdown */}
                    <div className="pt-2 space-y-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                        المسافة: {distanceKm?.toFixed(1)} كم
                      </p>
                    </div>
                  </div>
                ) : pricingResult?.needsAdminReview ? (
                  <div className="p-5 rounded-[1.5rem] space-y-2" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
                    <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري</p>
                    <p className="text-base font-black" style={{ color: "var(--brand)" }}>يتطلب مراجعة الإدارة</p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      المسافة ({distanceKm?.toFixed(1)} كم) تتجاوز 40 كم — سيتواصل معك فريقنا لتحديد السعر
                    </p>
                  </div>
                ) : (
                  <div className="p-5 rounded-[1.5rem] space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري</p>
                    <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                      يرجى تحديد الموقعين على الخريطة في الخطوة الثانية لحساب السعر تلقائياً
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>الاسم الكامل (اختياري)</label>
                  <Input
                    placeholder="مثال: سارة أحمد"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-2xl font-bold h-12 input-dark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>رقم الجوال *</label>
                  <Input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-2xl font-bold h-12 input-dark"
                    dir="ltr"
                  />
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>يُخفى عن السائقين حتى يتم اختيار أحدهم</p>
                </div>

                {/* Summary */}
                <div className="p-5 rounded-[1.5rem] space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--brand-border)" }}>
                  <h3 className="font-black text-sm mb-3" style={{ color: "var(--brand)" }}>ملخص الطلب</h3>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>نوع الاشتراك</span><span className="font-black">{clientType}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>من</span><span className="font-black text-left text-xs max-w-[55%] text-right">{homeLocation || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>إلى</span><span className="font-black text-left text-xs max-w-[55%] text-right">{workLocation || "—"}</span>
                  </div>
                  {additionalLocations.filter((l) => l.address.trim()).map((loc, idx) => (
                    <div key={idx} className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      <span>{loc.type === "pickup" ? "استلام إضافي" : "توصيل إضافي"}</span>
                      <span className="font-black text-xs max-w-[55%] text-right">{loc.address}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>أيام العمل</span><span className="font-black">{selectedDays.length} أيام</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>الركاب</span><span className="font-black">{sharingCount} أشخاص</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>نوع الاشتراك</span>
                    <span className="font-black" style={{ color: subscriptionType === "shared" ? "var(--status-frozen-text)" : "var(--brand)" }}>
                      {subscriptionType === "shared" ? "مشترك" : "خاص"}
                    </span>
                  </div>
                  {pricingResult && !pricingResult.needsAdminReview && (
                    <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      <span>السعر / شخص</span>
                      <span className="font-black" style={{ color: "var(--brand)" }}>
                        {pricingResult.pricePerPerson.toLocaleString("ar-SA")} ر.س
                      </span>
                    </div>
                  )}
                  {notes.trim() && (
                    <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      <span>ملاحظات</span><span className="font-black text-xs max-w-[55%] text-right">{notes.trim()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-4 rounded-[1.5rem] font-black transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)", backgroundColor: "var(--surface)" }}
              >
                رجوع
              </button>
            )}
            <button
              onClick={() => {
                if (step < 4) {
                  if (!canNext()) {
                    toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
                    return;
                  }
                  setStep(step + 1);
                } else {
                  if (!canNext()) {
                    toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
                    return;
                  }
                  handleSubmit();
                }
              }}
              disabled={createRequest.isPending}
              className="flex-1 font-black py-4 rounded-[1.5rem] text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "0 18px 36px var(--brand-border)" }}
            >
              {step === 4 ? (
                createRequest.isPending ? "جاري الإرسال..." : <><CheckCircle2 size={20} /> نشر الطلب للسائقين</>
              ) : (
                <>التالي <Clock size={16} aria-hidden="true" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
