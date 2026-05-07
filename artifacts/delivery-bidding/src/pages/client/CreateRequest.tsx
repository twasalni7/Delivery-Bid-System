import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h, formatTime12hLong, buildShiftsPayload, SHIFT_LABELS } from "@/lib/time-utils";
import { haversineKm } from "@/lib/pricing";
import MapPicker, { type MapCoords } from "@/components/MapPicker";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import {
  ArrowRight, Plus, X, Home, Briefcase, Users, Clock,
  CheckCircle2, Check, Share2, Lock,
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

const MAX_SHIFTS = 4;

type ShiftEntry = { goTime: string; returnTime: string };

type AdditionalLocation = { type: "pickup" | "dropoff"; address: string };

/** Per-passenger location and schedule data */
type ExtraPassenger = {
  pickupCoords: MapCoords | null;
  pickupAddress: string;
  destCoords: MapCoords | null;
  destAddress: string;
  workTime: string;
};

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

/** Maximum number of passengers supported per request */
const MAX_PASSENGERS = 10;

const STEP_TITLES = ["نوع الاشتراك", "تحديد المسار والركاب", "الجدول والوقت", "التفاصيل المالية"];

/** Single shift editor card used in Step 3 */
function ShiftCard({
  index,
  shift,
  onChange,
  onRemove,
}: {
  index: number;
  shift: ShiftEntry;
  onChange: (s: ShiftEntry) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] p-4 space-y-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-black" style={{ color: "var(--text)" }}>
          {SHIFT_LABELS[index] ?? `الوردية ${index + 1}`}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-xl transition-colors"
            style={{ color: "var(--status-cancelled-text)", backgroundColor: "var(--status-cancelled-bg)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-black" style={{ color: "var(--text-hint)" }}>⏰ وقت الذهاب</label>
          <Input
            type="time"
            value={shift.goTime}
            onChange={(e) => onChange({ ...shift, goTime: e.target.value })}
            className="rounded-2xl font-bold text-base input-dark"
            dir="ltr"
          />
          {shift.goTime && (
            <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>{formatTime12hLong(shift.goTime)}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black" style={{ color: "var(--text-hint)" }}>🔄 وقت العودة</label>
          <Input
            type="time"
            value={shift.returnTime}
            onChange={(e) => onChange({ ...shift, returnTime: e.target.value })}
            className="rounded-2xl font-bold text-base input-dark"
            dir="ltr"
          />
          {shift.returnTime && (
            <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{formatTime12hLong(shift.returnTime)}</p>
          )}
        </div>
      </div>
    </div>
  );
}



/** Passenger card shown once per passenger in Step 2 */
function PassengerCard({
  index,
  homeCoords,
  homeAddress,
  workCoords,
  workAddress,
  workTime,
  onHomeChange,
  onWorkChange,
  onWorkTimeChange,
}: {
  index: number;
  homeCoords: MapCoords | null;
  homeAddress: string;
  workCoords: MapCoords | null;
  workAddress: string;
  workTime: string;
  onHomeChange: (coords: MapCoords) => void;
  onWorkChange: (coords: MapCoords) => void;
  onWorkTimeChange: (t: string) => void;
}) {
  const distKm =
    homeCoords && workCoords
      ? haversineKm(homeCoords.lat, homeCoords.lng, workCoords.lat, workCoords.lng)
      : null;

  return (
    <div className="rounded-[2rem] p-4 space-y-4" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
      {/* Passenger header */}
      <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
          {index}
        </div>
        <span className="font-black" style={{ color: "var(--text)" }}>
          {index === 1 ? "الراكب الأول (أنت)" : `الراكب ${index}`}
        </span>
        {distKm !== null && (
          <span className="mr-auto text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
            {distKm.toFixed(1)} كم
          </span>
        )}
      </div>

      {/* Home map */}
      <div className="space-y-2">
        <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>
          <Home className="inline-block ml-1" size={14} style={{ color: "var(--brand)" }} />
          موقع المنزل
        </label>
        <MapPicker
          value={homeCoords}
          onChange={onHomeChange}
          placeholder="اضغط على الخريطة لتحديد موقع المنزل"
          color="var(--brand)"
          initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
        />
        <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
          <Home size={18} style={{ color: "var(--brand)" }} />
          <span className="text-sm font-bold truncate" style={{ color: homeAddress ? "var(--text)" : "var(--text-hint)" }}>
            {homeAddress || "لم يتم تحديد الموقع بعد"}
          </span>
        </div>
      </div>

      {/* Work map */}
      <div className="space-y-2">
        <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>
          <Briefcase className="inline-block ml-1 text-rose-500" size={14} />
          موقع الدوام
        </label>
        <MapPicker
          value={workCoords}
          onChange={onWorkChange}
          placeholder="اضغط على الخريطة لتحديد موقع العمل"
          color="var(--brand)"
          initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
        />
        <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
          <Briefcase size={18} className="text-rose-500" />
          <span className="text-sm font-bold truncate" style={{ color: workAddress ? "var(--text)" : "var(--text-hint)" }}>
            {workAddress || "لم يتم تحديد الموقع بعد"}
          </span>
        </div>
      </div>

      {/* Work time (for extra passengers) */}
      {index > 1 && (
        <div className="space-y-1">
          <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
            <Clock className="inline-block ml-1" size={14} style={{ color: "var(--brand)" }} />
            وقت الدوام (اختياري)
          </label>
          <Input
            type="time"
            value={workTime}
            onChange={(e) => onWorkTimeChange(e.target.value)}
            className="rounded-2xl font-bold text-base input-dark"
            dir="ltr"
          />
          {workTime && <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>{formatTime12h(workTime)}</p>}
        </div>
      )}
    </div>
  );
}

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(1);

  // Step 1
  const [clientType, setClientType] = useState("موظفات");

  // Step 2 — passenger 1 (main)
  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [homeCoords, setHomeCoords] = useState<MapCoords | null>(null);
  const [workCoords, setWorkCoords] = useState<MapCoords | null>(null);
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);

  // Step 2 — number of people + extra passengers
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [extraPassengers, setExtraPassengers] = useState<ExtraPassenger[]>([]);

  // Step 3
  const [shifts, setShifts] = useState<ShiftEntry[]>([{ goTime: "", returnTime: "" }]);
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

  // Compute per-passenger distances, then take the max for pricing
  const passengerDistances: (number | null)[] = [
    homeCoords && workCoords
      ? haversineKm(homeCoords.lat, homeCoords.lng, workCoords.lat, workCoords.lng)
      : null,
    ...extraPassengers.map((p) =>
      p.pickupCoords && p.destCoords
        ? haversineKm(p.pickupCoords.lat, p.pickupCoords.lng, p.destCoords.lat, p.destCoords.lng)
        : null
    ),
  ];
  const validDistances = passengerDistances.filter((d): d is number => d !== null);
  const maxDistanceKm = validDistances.length > 0 ? Math.max(...validDistances) : undefined;

  // Number of people for pricing: for shared subscription, add suggestion count
  const sharingCount =
    subscriptionType === "shared" && sharedSuggestions && sharedSuggestions.count > 0
      ? Math.min(parseInt(numberOfPeople) + sharedSuggestions.count, 4)
      : parseInt(numberOfPeople) || 1;

  // Sync extraPassengers length when numberOfPeople changes
  const handleSetNumberOfPeople = (n: number) => {
    const clamped = Math.max(1, Math.min(MAX_PASSENGERS, n));
    setNumberOfPeople(String(clamped));
    setExtraPassengers((prev) => {
      const needed = clamped - 1;
      if (needed > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: needed - prev.length }, () => ({
            pickupCoords: null,
            pickupAddress: "",
            destCoords: null,
            destAddress: "",
            workTime: "",
          })),
        ];
      }
      return prev.slice(0, needed);
    });
  };

  const updateExtraPassenger = (idx: number, update: Partial<ExtraPassenger>) => {
    setExtraPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...update } : p)));
  };

  // Fetch price from server whenever distance or passengers change
  useEffect(() => {
    if (maxDistanceKm === undefined) {
      setPricingResult(undefined);
      return;
    }
    const validShifts = buildShiftsPayload(shifts);
    const firstReturnTime = shifts[0]?.returnTime ?? "";
    fetch(`${API}/api/pricing/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        distanceKm: maxDistanceKm,
        numberOfPeople: sharingCount,
        workingDaysPerWeek: selectedDays.length || 5,
        numberOfShifts: validShifts.length || 1,
        eveningTime: firstReturnTime || undefined,
        shifts: validShifts.length > 0 ? validShifts : undefined,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(`pricing: ${r.status}`); return r.json(); })
      .then((data) => setPricingResult(data))
      .catch(() => setPricingResult(undefined));
  }, [maxDistanceKm, sharingCount, selectedDays.length, shifts]);

  // Fetch shared subscription suggestions whenever coordinates + time are set
  const fetchSuggestions = useCallback(() => {
    if (!homeCoords || !workCoords) return;
    const firstGoTime = shifts[0]?.goTime;
    const params = new URLSearchParams({
      homeLat: String(homeCoords.lat),
      homeLng: String(homeCoords.lng),
      destLat: String(workCoords.lat),
      destLng: String(workCoords.lng),
      ...(firstGoTime ? { morningTime: firstGoTime } : {}),
    });
    fetch(`${API}/api/pricing/suggestions?${params}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === "number") setSharedSuggestions({ count: d.count }); })
      .catch(() => {});
  }, [homeCoords, workCoords, shifts]);

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
  const updateLocation = (idx: number, field: "type" | "address", val: string) =>
    setAdditionalLocations((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l))
    );

  const canNext = () => {
    if (step === 1) return !!clientType;
    if (step === 2) {
      // Main passenger must have both coordinates
      if (!homeCoords || !workCoords) return false;
      // All extra passengers must also have coordinates
      if (extraPassengers.some((p) => !p.pickupCoords || !p.destCoords)) return false;
      return true;
    }
    if (step === 3) return !!(shifts[0]?.goTime) && selectedDays.length > 0;
    return phone.trim().length >= 10;
  };

  const handleSubmit = () => {
    const validAdditional = additionalLocations.filter((l) => l.address.trim());
    const sharingNote = subscriptionType === "shared" && sharedSuggestions && sharedSuggestions.count > 0
      ? `[اشتراك مشترك - ${sharingCount} أشخاص]`
      : null;
    const finalNotes = [sharingNote, notes.trim()].filter(Boolean).join(" — ") || undefined;

    // Derive backward-compat scalar times from the first shift
    const firstGoTime = shifts[0]?.goTime ?? "";
    const firstReturnTime = shifts[0]?.returnTime ?? "";
    const validShifts = buildShiftsPayload(shifts);

    // Build per-passenger array for the backend
    const passengersData = [
      {
        passengerIndex: 1,
        pickupLat: homeCoords?.lat ?? null,
        pickupLng: homeCoords?.lng ?? null,
        destinationLat: workCoords?.lat ?? null,
        destinationLng: workCoords?.lng ?? null,
        pickupAddress: homeLocation || homeCoords?.address || null,
        destinationAddress: workLocation || workCoords?.address || null,
        workTime: firstGoTime || null,
        daysPerWeek: selectedDays.length,
        distanceKm:
          homeCoords && workCoords
            ? haversineKm(homeCoords.lat, homeCoords.lng, workCoords.lat, workCoords.lng)
            : null,
      },
      ...extraPassengers.map((p, idx) => ({
        passengerIndex: idx + 2,
        pickupLat: p.pickupCoords?.lat ?? null,
        pickupLng: p.pickupCoords?.lng ?? null,
        destinationLat: p.destCoords?.lat ?? null,
        destinationLng: p.destCoords?.lng ?? null,
        pickupAddress: p.pickupAddress || p.pickupCoords?.address || null,
        destinationAddress: p.destAddress || p.destCoords?.address || null,
        workTime: p.workTime || firstGoTime || null,
        daysPerWeek: selectedDays.length,
        distanceKm:
          p.pickupCoords && p.destCoords
            ? haversineKm(p.pickupCoords.lat, p.pickupCoords.lng, p.destCoords.lat, p.destCoords.lng)
            : null,
      })),
    ];

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
          distanceKm: maxDistanceKm,
          additionalLocations: validAdditional.length > 0 ? validAdditional : undefined,
          phone: phone.trim(),
          numberOfPeople: parseInt(numberOfPeople) || 1,
          workingDaysPerWeek: selectedDays.length,
          numberOfShifts: validShifts.length || 1,
          morningTime: firstGoTime,
          eveningTime: firstReturnTime || undefined,
          shifts: validShifts.length > 0 ? validShifts : undefined,
          notes: finalNotes,
          passengers: passengersData,
          // monthlyPrice is intentionally not sent — the server calculates it
          // from coordinates using the DB pricing matrix to prevent manipulation.
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
            <h2 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: "var(--text)" }}>{STEP_TITLES[step - 1]}</h2>
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
                        <span className="text-[1.1rem] font-black" style={{ color: "var(--text)" }}>{t.label}</span>
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

            {/* ── Step 2: Route & Passengers ── */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Number of people selector */}
                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                    <Users className="inline-block ml-1" size={14} style={{ color: "var(--brand)" }} />
                    عدد الأشخاص
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleSetNumberOfPeople(parseInt(numberOfPeople) - 1)}
                      className="w-10 h-10 rounded-full font-black text-xl transition-colors"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                    >−</button>
                    <span className="text-[1.8rem] font-black w-10 text-center" style={{ color: "var(--brand)" }}>{numberOfPeople}</span>
                    <button
                      onClick={() => handleSetNumberOfPeople(parseInt(numberOfPeople) + 1)}
                      className="w-10 h-10 rounded-full font-black text-xl transition-colors"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                    >+</button>
                  </div>
                  {parseInt(numberOfPeople) > 1 && (
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      يجب تحديد موقع المنزل والعمل لكل راكب على الخريطة
                    </p>
                  )}
                </div>

                {/* Passenger 1 card */}
                <PassengerCard
                  index={1}
                  homeCoords={homeCoords}
                  homeAddress={homeLocation}
                  workCoords={workCoords}
                  workAddress={workLocation}
                  workTime={shifts[0]?.goTime ?? ""}
                  onHomeChange={(coords) => {
                    setHomeCoords(coords);
                    setHomeLocation(coords.address);
                  }}
                  onWorkChange={(coords) => {
                    setWorkCoords(coords);
                    setWorkLocation(coords.address);
                  }}
                  onWorkTimeChange={() => {}}
                />

                {/* Extra passenger cards */}
                {extraPassengers.map((p, idx) => (
                  <PassengerCard
                    key={idx}
                    index={idx + 2}
                    homeCoords={p.pickupCoords}
                    homeAddress={p.pickupAddress}
                    workCoords={p.destCoords}
                    workAddress={p.destAddress}
                    workTime={p.workTime}
                    onHomeChange={(coords) =>
                      updateExtraPassenger(idx, { pickupCoords: coords, pickupAddress: coords.address })
                    }
                    onWorkChange={(coords) =>
                      updateExtraPassenger(idx, { destCoords: coords, destAddress: coords.address })
                    }
                    onWorkTimeChange={(t) => updateExtraPassenger(idx, { workTime: t })}
                  />
                ))}

                {/* Max distance summary */}
                {maxDistanceKm !== undefined && (
                  <div className="p-4 rounded-[1.5rem]" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      أقصى مسافة:{" "}
                      <span className="font-black" style={{ color: "var(--text)" }}>
                        {maxDistanceKm.toFixed(1)} كم
                      </span>
                      {parseInt(numberOfPeople) > 1 && (
                        <span className="text-xs mr-2" style={{ color: "var(--text-hint)" }}>
                          (تُستخدم لحساب السعر الإجمالي)
                        </span>
                      )}
                    </p>
                    {parseInt(numberOfPeople) > 1 && (
                      <div className="mt-2 space-y-0.5">
                        {passengerDistances.map((d, i) => (
                          d !== null && (
                            <p key={i} className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                              الراكب {i + 1}: {d.toFixed(1)} كم
                            </p>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Additional stops */}
                {additionalLocations.map((loc, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <select
                          value={loc.type}
                          onChange={(e) => updateLocation(idx, "type", e.target.value)}
                          className="rounded-2xl px-3 py-2.5 text-sm font-bold focus:outline-none"
                          style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                        >
                          <option value="pickup">استلام</option>
                          <option value="dropoff">توصيل</option>
                        </select>
                        <Input
                          placeholder="العنوان..."
                          value={loc.address}
                          onChange={(e) => updateLocation(idx, "address", e.target.value)}
                          className="flex-1 rounded-2xl font-bold input-dark"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeLocation(idx)}
                      className="mt-2.5 p-2 rounded-xl transition-colors"
                      style={{ color: "var(--status-cancelled-text)", backgroundColor: "var(--status-cancelled-bg)" }}
                    >
                      <X size={16} />
                    </button>
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
                {/* Multi-shift editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                      <Clock className="inline-block ml-1" size={14} style={{ color: "var(--brand)" }} />
                      الأوقات / الورديات
                    </label>
                    <span className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                      {shifts.length} / {MAX_SHIFTS}
                    </span>
                  </div>

                  {shifts.map((shift, idx) => (
                    <ShiftCard
                      key={idx}
                      index={idx}
                      shift={shift}
                      onChange={(updated) =>
                        setShifts((prev) => prev.map((s, i) => (i === idx ? updated : s)))
                      }
                      onRemove={
                        shifts.length > 1
                          ? () => setShifts((prev) => prev.filter((_, i) => i !== idx))
                          : undefined
                      }
                    />
                  ))}

                  {shifts.length < MAX_SHIFTS && (
                    <button
                      onClick={() => setShifts((prev) => [...prev, { goTime: "", returnTime: "" }])}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] border-2 border-dashed text-sm font-black transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    >
                      <Plus size={15} /> إضافة وردية
                    </button>
                  )}
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
                        السعر للشخص
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-[2.5rem] font-black leading-none" style={{ color: "var(--brand)" }}>
                          {pricingResult.pricePerPerson.toLocaleString("ar-SA")}
                        </p>
                        <p className="text-base font-black" style={{ color: "var(--text-muted)" }}>ر.س / شخص / شهر</p>
                      </div>
                      {sharingCount > 1 && (
                        <p className="text-sm font-bold" style={{ color: "var(--text-hint)" }}>
                          ({sharingCount} أشخاص — الإجمالي: {pricingResult.price.toLocaleString("ar-SA")} ر.س)
                        </p>
                      )}
                    </div>

                    {/* Pricing breakdown */}
                    <div className="pt-2 space-y-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                        أقصى مسافة: {maxDistanceKm?.toFixed(1)} كم
                      </p>
                    </div>
                  </div>
                ) : pricingResult?.needsAdminReview ? (
                  <div className="p-5 rounded-[1.5rem] space-y-2" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
                    <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري</p>
                    <p className="text-base font-black" style={{ color: "var(--brand)" }}>يتطلب مراجعة الإدارة</p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      المسافة ({maxDistanceKm?.toFixed(1)} كم) تتجاوز 40 كم — سيتواصل معك فريقنا لتحديد السعر
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
                    <span>الراكب 1 (من)</span><span className="font-black text-left text-xs max-w-[55%] text-right">{homeLocation || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>الراكب 1 (إلى)</span><span className="font-black text-left text-xs max-w-[55%] text-right">{workLocation || "—"}</span>
                  </div>
                  {extraPassengers.map((p, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                        <span>الراكب {idx + 2} (من)</span>
                        <span className="font-black text-xs max-w-[55%] text-right">{p.pickupAddress || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                        <span>الراكب {idx + 2} (إلى)</span>
                        <span className="font-black text-xs max-w-[55%] text-right">{p.destAddress || "—"}</span>
                      </div>
                    </div>
                  ))}
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
                    <>
                      <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                        <span>السعر / شخص</span>
                        <span className="font-black" style={{ color: "var(--brand)" }}>
                          {pricingResult.pricePerPerson.toLocaleString("ar-SA")} ر.س
                        </span>
                      </div>
                      {sharingCount > 1 && (
                        <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                          <span>الإجمالي الشهري</span>
                          <span className="font-black" style={{ color: "var(--brand)" }}>
                            {pricingResult.price.toLocaleString("ar-SA")} ر.س
                          </span>
                        </div>
                      )}
                    </>
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
                    const msg = step === 2
                      ? "يرجى تحديد موقع المنزل والعمل على الخريطة لجميع الركاب"
                      : "يرجى ملء الحقول المطلوبة";
                    toast({ title: msg, variant: "destructive" });
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
