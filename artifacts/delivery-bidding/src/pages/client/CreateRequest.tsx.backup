import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h, formatTime12hLong, buildShiftsPayload, SHIFT_LABELS } from "@/lib/time-utils";
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
const DEFAULT_WORKING_DAYS_PER_WEEK = 5;

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

const PASSENGER_LOCATION_MESSAGES = {
  start: "ابدأ بتحديد موقع الانطلاق",
  dropoff: "حدد موقع الوصول",
  complete: "تم تحديد الموقعين",
} as const;

function getPassengerLocationStatus(hasPickup: boolean, hasDropoff: boolean) {
  if (!hasPickup) return PASSENGER_LOCATION_MESSAGES.start;
  if (!hasDropoff) return PASSENGER_LOCATION_MESSAGES.dropoff;
  return PASSENGER_LOCATION_MESSAGES.complete;
}

function calculateDropoffMapCenter(homeCoords: MapCoords | null, workCoords: MapCoords | null): [number, number] | undefined {
  if (workCoords) return [workCoords.lat, workCoords.lng];
  if (homeCoords) return [homeCoords.lat, homeCoords.lng];
  return undefined;
}

function PricePreview({
  isPricingLoading,
  pricingResult,
  routeSummary,
  sharingCount,
}: {
  isPricingLoading: boolean;
  pricingResult:
    | {
        pricePerPerson: number;
        price: number;
        needsAdminReview: boolean;
        distanceKm: number;
        numberOfPeople: number;
      }
    | undefined;
  routeSummary:
    | {
        distanceKm: number;
        durationMinutes: number;
        routePolyline: string;
      }
    | undefined;
  sharingCount: number;
}) {
  const hasPrice = Boolean(pricingResult && !pricingResult.needsAdminReview);
  const total = pricingResult?.price ?? 0;
  const perPerson = pricingResult?.pricePerPerson ?? 0;

  return (
    <div
      className="rounded-[1.75rem] overflow-hidden"
      style={{
        backgroundColor: "rgba(21,27,45,0.86)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-xl)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide" style={{ color: "var(--text-hint)" }}>💰 معاينة السعر</p>
          <p className="text-sm font-black mt-1" style={{ color: "var(--text)" }}>
            {isPricingLoading ? "جاري الحساب..." : hasPrice ? "سعر واضح ونهائي قبل الإرسال" : "حددي المواقع لحساب السعر تلقائياً"}
          </p>
          <p className="text-[11px] font-bold mt-1" style={{ color: "var(--text-muted)" }}>
            لا يوجد دفع مقدم • الدفع آخر الشهر للسائق مباشرة
          </p>
        </div>
        <div className="shrink-0 text-left">
          {isPricingLoading ? (
            <div className="w-6 h-6 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-border)", borderTopColor: "var(--brand)" }} />
          ) : hasPrice ? (
            <div>
              <p className="text-xs font-black" style={{ color: "var(--text-hint)" }}>للشخص</p>
              <p className="text-xl font-black leading-none" style={{ color: "var(--brand)" }}>
                {perPerson.toLocaleString("ar-SA")}
                <span className="text-xs font-black mr-1" style={{ color: "var(--text-hint)" }}>ر.س</span>
              </p>
            </div>
          ) : (
            <p className="text-xs font-black px-3 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-hint)", border: "1px solid rgba(255,255,255,0.08)" }}>
              غير متاح
            </p>
          )}
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] font-black" style={{ color: "var(--text-hint)" }}>المسافة</p>
          <p className="text-sm font-black mt-0.5" style={{ color: "var(--text)" }}>
            {routeSummary?.distanceKm != null ? `${routeSummary.distanceKm.toFixed(1)} كم` : "—"}
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] font-black" style={{ color: "var(--text-hint)" }}>الزمن التقريبي</p>
          <p className="text-sm font-black mt-0.5" style={{ color: "var(--text)" }}>
            {routeSummary?.durationMinutes != null ? `${routeSummary.durationMinutes.toFixed(0)} دقيقة` : "—"}
          </p>
        </div>
        {sharingCount > 1 && hasPrice && (
          <div className="col-span-2 rounded-2xl p-3 flex items-center justify-between" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
            <p className="text-xs font-black" style={{ color: "var(--text-sub)" }}>الإجمالي ({sharingCount} أشخاص)</p>
            <p className="text-sm font-black" style={{ color: "var(--brand)" }}>
              {total.toLocaleString("ar-SA")} ر.س
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Progress Steps Bar ── */
function ProgressSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="px-3 sm:px-8 mb-7 relative">
      <div className="absolute left-8 right-8 h-[2px] top-5 -z-10 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
      <div
        className="absolute right-8 h-[2px] top-5 -z-10 transition-all duration-700 rounded-full"
        style={{ backgroundColor: "var(--brand)", left: "2rem", width: `${((currentStep - 1) / 2) * 100}%` }}
      />
      <div className="flex justify-between items-center gap-2">
        {VISUAL_STEP_TITLES.map((label, idx) => {
          const s = idx + 1;
          const active = s <= currentStep;
          const stepState = s < currentStep ? "مكتملة" : s === currentStep ? "الحالية" : "قادمة";
          return (
            <div key={s} className="flex flex-col items-center gap-2 z-10 min-w-0">
              <div
                className="w-10 h-10 rounded-full border transition-all duration-500 shadow-md flex items-center justify-center text-sm font-black"
                style={active ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.18)", color: "var(--text-hint)" }}
                aria-label={`الخطوة ${s}: ${STEP_TITLES[idx]} - ${stepState}`}
                title={`الخطوة ${s}: ${STEP_TITLES[idx]} - ${stepState}`}
              >
                {s < currentStep ? <Check size={16} strokeWidth={4} /> : s}
              </div>
              <p className="text-[11px] sm:text-xs font-black truncate max-w-[7.5rem]" style={{ color: active ? "var(--text)" : "var(--text-hint)" }}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Maximum number of passengers supported per request */
const MAX_PASSENGERS = 10;

const STEP_TITLES = ["نوع الاشتراك", "عدد الأشخاص", "تحديد المواقع", "الجدول والوقت", "التفاصيل المالية"];
const VISUAL_STEP_TITLES = ["مواقع الرحلة", "الأوقات والشفتات", "التفاصيل والتأكيد"];

function getVisualStepFromInternal(step: number) {
  if (step <= 3) return 1;
  if (step === 4) return 2;
  return 3;
}

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
  const hasPickup = Boolean(homeCoords);
  const hasDropoff = Boolean(workCoords);
  const statusText = getPassengerLocationStatus(hasPickup, hasDropoff);
  const dropoffInitialCenter = calculateDropoffMapCenter(homeCoords, workCoords);

  return (
    <div className="rounded-[1.75rem] p-5 space-y-5" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
      <div className="flex items-start gap-3 pb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
          {index}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black" style={{ color: "var(--text)" }}>
              {index === 1 ? "الراكب الأول (أنت)" : `الراكب ${index}`}
            </span>
          </div>
          <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm font-black" style={{ color: hasDropoff ? "var(--brand)" : "var(--text-sub)" }}>
            {hasDropoff && <CheckCircle2 size={14} aria-hidden="true" />}
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-3 pb-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between gap-3">
            <label className="text-base font-black pr-1" style={{ color: "var(--text)" }}>
              <Home className="inline-block ml-1" size={16} style={{ color: "var(--brand)" }} />
              موقع الانطلاق
            </label>
            {hasPickup && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                تم التحديد
              </span>
            )}
          </div>
          <MapPicker
            value={homeCoords}
            onChange={onHomeChange}
            placeholder="حدد موقع الانطلاق من الخريطة"
            color="var(--brand)"
            initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
            openButtonLabel="حدد موقع الانطلاق"
            openButtonHint="لم يتم تحديد الموقع بعد"
            collapsible
          />
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", color: homeAddress ? "var(--text)" : "var(--text-sub)" }}>
            <Home size={18} style={{ color: "var(--brand)" }} />
            <span className="text-sm font-black truncate">
              {homeAddress || "لم يتم تحديد الموقع بعد"}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-base font-black pr-1" style={{ color: "var(--text)" }}>
              <Briefcase className="inline-block ml-1" size={16} style={{ color: "var(--brand)" }} />
              موقع الوصول
            </label>
            {hasDropoff && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                تم التحديد
              </span>
            )}
          </div>

          {hasPickup ? (
            <>
              <MapPicker
                value={workCoords}
                onChange={onWorkChange}
                placeholder="حدد موقع الوصول من الخريطة"
                color="var(--brand)"
                initialCenter={dropoffInitialCenter}
                openButtonLabel="حدد موقع الوصول"
                openButtonHint="لم يتم تحديد الموقع بعد"
                collapsible
              />
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", color: workAddress ? "var(--text)" : "var(--text-sub)" }}>
                <Briefcase size={18} style={{ color: "var(--brand)" }} />
                <span className="text-sm font-black truncate">
                  {workAddress || "لم يتم تحديد الموقع بعد"}
                </span>
              </div>
            </>
          ) : (
            <div role="note" className="rounded-2xl px-4 py-4 text-sm font-black" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", border: "1px dashed var(--border)" }}>
              حدد موقع الانطلاق أولًا
            </div>
          )}
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
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");

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
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMinutes: number;
    routePolyline: string;
  } | undefined>(undefined);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // Number of people for pricing: for shared subscription, add suggestion count
  const sharingCount =
    subscriptionType === "shared" && sharedSuggestions && sharedSuggestions.count > 0
      ? Math.min(parseInt(numberOfPeople) + sharedSuggestions.count, 4)
      : parseInt(numberOfPeople) || 1;
  const visualStep = getVisualStepFromInternal(step);
  const visualTitle = VISUAL_STEP_TITLES[visualStep - 1];

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

  // Fetch route summary + price from backend whenever locations or schedule change
  useEffect(() => {
    if (!homeCoords || !workCoords) {
      setRouteSummary(undefined);
      setPricingResult(undefined);
      return;
    }
    const controller = new AbortController();
    const validShifts = buildShiftsPayload(shifts);
    const firstReturnTime = shifts[0]?.returnTime ?? "";
    const validAdditionalForPricing = additionalLocations.filter((l) => l.address.trim());
    setIsPricingLoading(true);
    fetch(`${API}/api/maps/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      signal: controller.signal,
      body: JSON.stringify({
        points: [
          { lat: homeCoords.lat, lng: homeCoords.lng, address: homeCoords.address, type: "pickup" },
          { lat: workCoords.lat, lng: workCoords.lng, address: workCoords.address, type: "dropoff" },
        ],
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(`route: ${r.status}`); return r.json(); })
      .then((route) => {
        setRouteSummary(route);
        return fetch(`${API}/api/pricing/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          signal: controller.signal,
          body: JSON.stringify({
            distanceKm: route.distanceKm,
            numberOfPeople: sharingCount,
            workingDaysPerWeek: selectedDays.length || DEFAULT_WORKING_DAYS_PER_WEEK,
            numberOfShifts: validShifts.length || 1,
            eveningTime: firstReturnTime || undefined,
            shifts: validShifts.length > 0 ? validShifts : undefined,
            additionalLocations: validAdditionalForPricing.length > 0 ? validAdditionalForPricing : undefined,
          }),
        });
      })
      .then((r) => { if (!r.ok) throw new Error(`pricing: ${r.status}`); return r.json(); })
      .then((data) => { setPricingResult(data); setIsPricingLoading(false); })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setRouteSummary(undefined);
          setPricingResult(undefined);
          setIsPricingLoading(false);
        }
      });
    return () => controller.abort();
  }, [homeCoords, workCoords, sharingCount, selectedDays, shifts, additionalLocations]);

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
    if (step === 5 && homeCoords && workCoords) {
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
    if (step === 2) return (parseInt(numberOfPeople) || 0) >= 1;
    if (step === 3) {
      // Main passenger must have both coordinates
      if (!homeCoords || !workCoords) return false;
      // All extra passengers must also have coordinates
      if (extraPassengers.some((p) => !p.pickupCoords || !p.destCoords)) return false;
      return true;
    }
    if (step === 4) return !!(shifts[0]?.goTime) && selectedDays.length > 0;
    return true; // Step 5 has no required fields now
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
          distanceKm: routeSummary?.distanceKm,
          additionalLocations: validAdditional.length > 0 ? validAdditional : undefined,
          // phone is no longer sent - server fetches it from logged-in client
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
      <div dir="rtl" className="pb-56">
        <Link href="/client" className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors mb-5 px-3 py-2 rounded-xl" style={{ color: "var(--text-muted)", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ArrowRight size={15} /> العودة لاشتراكاتي
        </Link>

        <div className="mb-5">
          <h1 className="text-[1.9rem] font-black tracking-tight leading-none" style={{ color: "var(--text)" }}>طلب اشتراك جديد</h1>
          <p className="text-sm font-bold mt-1" style={{ color: "var(--text-muted)" }}>{visualTitle}</p>
        </div>

        <ProgressSteps currentStep={visualStep} />

        <div className="rounded-[2rem] overflow-hidden" style={{ background: "linear-gradient(160deg, rgba(18,27,43,0.72) 0%, rgba(9,14,23,0.88) 45%, rgba(6,10,16,0.96) 100%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 56px rgba(0,0,0,0.55)" }}>
          {/* Step header */}
          <div className="text-center px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-[1.55rem] font-black tracking-tight leading-none" style={{ color: "var(--text)" }}>{visualTitle}</h2>
          </div>

          <div className="p-6 space-y-5">
            <div key={`${step}-${stepDirection}`} className={`space-y-5 ${stepDirection === "forward" ? "step-enter-forward" : "step-enter-backward"}`}>
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

            {/* ── Step 2: Number of people ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-[1.8rem] p-5 space-y-5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                    <Users className="inline-block ml-1" size={16} style={{ color: "var(--brand)" }} />
                    اختر عدد الأشخاص في الاشتراك
                  </label>
                  <div className="flex items-center justify-center gap-5">
                    <button
                      onClick={() => handleSetNumberOfPeople(parseInt(numberOfPeople) - 1)}
                      className="w-12 h-12 rounded-full font-black text-2xl transition-all active:scale-90"
                      style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                    >−</button>
                    <div className="text-center min-w-[6rem]">
                      <p key={numberOfPeople} className="text-[2.3rem] font-black counter-pop leading-none" style={{ color: "var(--brand)" }}>
                        {numberOfPeople}
                      </p>
                      <p className="text-xs font-bold mt-1" style={{ color: "var(--text-muted)" }}>من 1 إلى {MAX_PASSENGERS}</p>
                    </div>
                    <button
                      onClick={() => handleSetNumberOfPeople(parseInt(numberOfPeople) + 1)}
                      className="w-12 h-12 rounded-full font-black text-2xl transition-all active:scale-90"
                      style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                    >+</button>
                  </div>
                  <p className="text-sm font-bold text-center" style={{ color: "var(--text-muted)" }}>
                    في الخطوة التالية ستحدد مواقع {parseInt(numberOfPeople) === 1 ? "الراكب" : "جميع الركاب"} عبر خيار اختيار الموقع من الخريطة.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 3: Locations ── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-[1.5rem] px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-sm font-black" style={{ color: "var(--text)" }}>
                    ابدأ بتحديد موقع الانطلاق، ثم أضف موقع الوصول.
                  </p>
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
                {routeSummary && (
                  <div className="p-4 rounded-[1.5rem]" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      المسافة عبر الطرق:{" "}
                      <span className="font-black" style={{ color: "var(--text)" }}>
                        {routeSummary.distanceKm.toFixed(1)} كم
                      </span>
                    </p>
                    <p className="mt-2 text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                      زمن الرحلة التقريبي: {routeSummary.durationMinutes.toFixed(0)} دقيقة
                    </p>
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

            {/* ── Step 4: Schedule ── */}
            {step === 4 && (
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

            {/* ── Step 5: Financial & Contact ── */}
            {step === 5 && (
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
                {isPricingLoading ? (
                  <div className="p-5 rounded-[1.5rem] flex items-center gap-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                    <div className="w-5 h-5 rounded-full border-4 border-t-transparent animate-spin shrink-0" style={{ borderColor: "var(--brand-border)", borderTopColor: "var(--brand)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>جاري حساب السعر...</p>
                  </div>
                ) : pricingResult && !pricingResult.needsAdminReview ? (
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
                        المسافة عبر الطرق: {routeSummary?.distanceKm?.toFixed(1) ?? "—"} كم
                      </p>
                      <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                        ETA: {routeSummary?.durationMinutes?.toFixed(0) ?? "—"} دقيقة
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-[1.5rem] space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري</p>
                    <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                      يرجى تحديد الموقعين على الخريطة في الخطوة الثالثة لحساب السعر تلقائياً
                    </p>
                  </div>
                )}

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
                  {isPricingLoading ? (
                    <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      <span>السعر</span>
                      <span className="font-black" style={{ color: "var(--text-muted)" }}>جاري الحساب...</span>
                    </div>
                  ) : pricingResult && !pricingResult.needsAdminReview ? (
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
                  ) : null}
                  {notes.trim() && (
                    <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                      <span>ملاحظات</span><span className="font-black text-xs max-w-[55%] text-right">{notes.trim()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 1 && (
              <button
                onClick={() => {
                  setStepDirection("backward");
                  setStep(step - 1);
                }}
                className="px-6 py-4 rounded-[1.5rem] font-black transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-sub)", backgroundColor: "var(--surface)" }}
              >
                رجوع
              </button>
            )}
            <button
              onClick={() => {
                if (step < 5) {
                  if (!canNext()) {
                    const msg = step === 3
                      ? "يرجى تحديد موقعي الانطلاق والوصول لجميع الركاب"
                      : "يرجى ملء الحقول المطلوبة";
                    toast({ title: msg, variant: "destructive" });
                    return;
                  }
                  setStepDirection("forward");
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
              aria-label={step === 5 ? "نشر الطلب للسائقين" : `الانتقال إلى ${STEP_TITLES[step]}`}
              className="flex-1 font-black py-4 rounded-[1.5rem] text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "var(--brand-shadow)" }}
              >
                {step === 5 ? (
                  createRequest.isPending ? "جاري الإرسال..." : <><CheckCircle2 size={20} /> نشر الطلب للسائقين</>
                ) : (
                  (() => {
                    const nextVisualStep = getVisualStepFromInternal(step + 1);
                    if (nextVisualStep !== visualStep) {
                      return `التالي: ${VISUAL_STEP_TITLES[nextVisualStep - 1]}`;
                    }
                    return "التالي";
                  })()
                )}
            </button>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 inset-x-0 z-40 px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mx-auto max-w-xl">
          <PricePreview
            isPricingLoading={isPricingLoading}
            pricingResult={pricingResult}
            routeSummary={routeSummary}
            sharingCount={sharingCount}
          />
        </div>
      </div>
    </Layout>
  );
}
