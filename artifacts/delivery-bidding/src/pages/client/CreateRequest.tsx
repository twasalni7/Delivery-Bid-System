import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { buildShiftsPayload, formatTime12hLong, SHIFT_LABELS } from "@/lib/time-utils";
import MapPicker, { type MapCoords } from "@/components/MapPicker";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import {
  ArrowLeft, Check, Clock, Calendar, CheckCircle2, Edit3,
  Plus, X, Home, Briefcase, MapPin, Loader2, Users,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIENT_TYPES = [
  { value: "موظفات", label: "موظفة", emoji: "👩‍💼" },
  { value: "معلمات", label: "معلمة", emoji: "👩‍🏫" },
  { value: "جامعات", label: "طالبة جامعة", emoji: "🎓" },
  { value: "طلاب", label: "طالب", emoji: "📚" },
  { value: "مدارس", label: "مدارس", emoji: "🏫" },
  { value: "غيره", label: "أخرى", emoji: "📦" },
];

const DAYS = [
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الإثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
];

const MAX_PASSENGERS = 10;
const MAX_SHIFTS = 4;
const TOTAL_STEPS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftEntry = { goTime: string; returnTime: string };

type PassengerEntry = {
  pickupCoords: MapCoords | null;
  destCoords: MapCoords | null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Live price mini-card shown after locations are set */
function PriceBadge({
  isPricingLoading,
  pricingResult,
  routeSummary,
  numberOfPeople,
}: {
  isPricingLoading: boolean;
  pricingResult: { pricePerPerson: number; price: number; needsAdminReview: boolean } | undefined;
  routeSummary: { distanceKm: number; durationMinutes: number } | undefined;
  numberOfPeople: number;
}) {
  if (!routeSummary && !isPricingLoading) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-subtle)" }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--brand-border)" }}>
        <p className="text-sm font-black" style={{ color: "var(--text)" }}>💰 معاينة السعر التقريبي</p>
        {isPricingLoading && <Loader2 size={16} className="animate-spin shrink-0" style={{ color: "var(--brand)" }} />}
        {!isPricingLoading && pricingResult && !pricingResult.needsAdminReview && (
          <p className="text-lg font-black shrink-0" style={{ color: "var(--brand)" }}>
            {pricingResult.pricePerPerson.toLocaleString("ar-SA")}
            <span className="text-xs font-bold mr-1">ر.س / شهر</span>
          </p>
        )}
      </div>
      <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
        {routeSummary && (
          <>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              📍 {routeSummary.distanceKm.toFixed(1)} كم
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              ⏱ {Math.round(routeSummary.durationMinutes)} دقيقة
            </span>
          </>
        )}
        {numberOfPeople > 1 && pricingResult && !pricingResult.needsAdminReview && (
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            👥 الإجمالي: {pricingResult.price.toLocaleString("ar-SA")} ر.س
          </span>
        )}
        {pricingResult?.needsAdminReview && (
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            سيراجع الإداري السعر
          </span>
        )}
      </div>
    </div>
  );
}

/** Single passenger location card */
function PassengerCard({
  index,
  passenger,
  onChange,
}: {
  index: number;
  passenger: PassengerEntry;
  onChange: (updated: PassengerEntry) => void;
}) {
  const [expandPickup, setExpandPickup] = useState(!passenger.pickupCoords);
  const [expandDropoff, setExpandDropoff] = useState(false);

  const hasPickup = Boolean(passenger.pickupCoords);
  const hasDropoff = Boolean(passenger.destCoords);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--surface-2)" }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
          style={{ backgroundColor: hasPickup && hasDropoff ? "var(--brand)" : "var(--border)", color: hasPickup && hasDropoff ? "var(--brand-fg)" : "var(--text-muted)" }}
        >
          {hasPickup && hasDropoff ? <Check size={14} strokeWidth={3} /> : index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black" style={{ color: "var(--text)" }}>
            {index === 1 ? "الراكب الأول (أنت)" : `الراكب ${index}`}
          </p>
          <p className="text-xs font-bold" style={{ color: hasPickup && hasDropoff ? "var(--brand)" : "var(--text-muted)" }}>
            {!hasPickup ? "حدد موقع الانطلاق أولاً" : !hasDropoff ? "أضف موقع الوصول" : "✓ تم تحديد الموقعين"}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Pickup */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-black flex items-center gap-2" style={{ color: "var(--text-sub)" }}>
              <Home size={14} style={{ color: "var(--brand)" }} /> موقع الانطلاق
            </label>
            {hasPickup && (
              <button
                onClick={() => {
                  setExpandPickup((v) => !v);
                }}
                className="text-xs font-black px-2 py-1 rounded-lg"
                style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
              >
                {expandPickup ? "إخفاء" : "تعديل"}
              </button>
            )}
          </div>
          {hasPickup && !expandPickup && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
              <MapPin size={14} style={{ color: "var(--brand)" }} />
              <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{passenger.pickupCoords!.address}</p>
            </div>
          )}
          {(!hasPickup || expandPickup) && (
            <MapPicker
              value={passenger.pickupCoords}
              onChange={(coords) => {
                onChange({ ...passenger, pickupCoords: coords });
                setExpandPickup(false);
                if (!passenger.destCoords) setExpandDropoff(true);
              }}
              placeholder="ابحث عن حي أو مكان ثم اضغط تأكيد"
              color="var(--brand)"
              collapsible
              openButtonLabel="اضغط لتحديد موقع الانطلاق"
              openButtonHint="ابحث عن اسم الحي أو المكان"
            />
          )}
        </div>

        {/* Dropoff — shown only after pickup is set */}
        {hasPickup && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black flex items-center gap-2" style={{ color: "var(--text-sub)" }}>
                <Briefcase size={14} style={{ color: "var(--brand)" }} /> موقع الوصول
              </label>
              {hasDropoff && (
                <button
                  onClick={() => setExpandDropoff((v) => !v)}
                  className="text-xs font-black px-2 py-1 rounded-lg"
                  style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                >
                  {expandDropoff ? "إخفاء" : "تعديل"}
                </button>
              )}
            </div>
            {hasDropoff && !expandDropoff && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
                <MapPin size={14} style={{ color: "#F59E0B" }} />
                <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{passenger.destCoords!.address}</p>
              </div>
            )}
            {(!hasDropoff || expandDropoff) && (
              <MapPicker
                value={passenger.destCoords}
                onChange={(coords) => {
                  onChange({ ...passenger, destCoords: coords });
                  setExpandDropoff(false);
                }}
                placeholder="ابحث عن اسم المستشفى أو المدرسة..."
                color="#F59E0B"
                collapsible
                initialCenter={passenger.pickupCoords ? [passenger.pickupCoords.lat, passenger.pickupCoords.lng] : undefined}
                openButtonLabel="اضغط لتحديد موقع الوصول"
                openButtonHint="ابحث عن اسم الجهة أو المكان"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Single shift time editor */
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
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-black" style={{ color: "var(--text)" }}>
          {SHIFT_LABELS[index] ?? `الوردية ${index + 1}`}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-xl"
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
            className="rounded-xl font-bold text-base"
            style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)", color: "var(--text)" }}
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
            className="rounded-xl font-bold text-base"
            style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)", color: "var(--text)" }}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateRequestNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(1);

  // Step 1: Client type
  const [clientType, setClientType] = useState("");

  // Step 2: Number of people + passenger location entries
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [passengers, setPassengers] = useState<PassengerEntry[]>([{ pickupCoords: null, destCoords: null }]);

  // Step 4: Shifts
  const [shifts, setShifts] = useState<ShiftEntry[]>([{ goTime: "", returnTime: "" }]);

  // Step 4: Days
  const [selectedDays, setSelectedDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Derived convenience refs to first passenger
  const homeCoords = passengers[0]?.pickupCoords ?? null;
  const workCoords = passengers[0]?.destCoords ?? null;

  // Sync passengers array length to numberOfPeople
  const handleSetNumberOfPeople = (n: number) => {
    const clamped = Math.max(1, Math.min(MAX_PASSENGERS, n));
    setNumberOfPeople(clamped);
    setPassengers((prev) => {
      if (clamped > prev.length) {
        return [...prev, ...Array.from({ length: clamped - prev.length }, () => ({ pickupCoords: null, destCoords: null }))];
      }
      return prev.slice(0, clamped);
    });
  };

  const updatePassenger = (idx: number, updated: PassengerEntry) =>
    setPassengers((prev) => prev.map((p, i) => (i === idx ? updated : p)));

  // Pricing
  const [pricingResult, setPricingResult] = useState<{
    pricePerPerson: number;
    price: number;
    needsAdminReview: boolean;
    distanceKm: number;
  } | undefined>(undefined);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMinutes: number;
  } | undefined>(undefined);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // Auto-recalculate price whenever locations, people, days, or shifts change
  useEffect(() => {
    if (!homeCoords || !workCoords) {
      setRouteSummary(undefined);
      setPricingResult(undefined);
      return;
    }
    const controller = new AbortController();
    const firstReturnTime = shifts[0]?.returnTime ?? "";
    const validShifts = buildShiftsPayload(shifts);

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
            numberOfPeople,
            workingDaysPerWeek: selectedDays.length || 5,
            numberOfShifts: validShifts.length || 1,
            eveningTime: firstReturnTime || undefined,
            shifts: validShifts.length > 0 ? validShifts : undefined,
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
  }, [homeCoords, workCoords, numberOfPeople, selectedDays, shifts]);

  const toggleDay = (key: string) =>
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );

  const canNext = (): boolean => {
    if (step === 1) return !!clientType;
    if (step === 2) return numberOfPeople >= 1;
    if (step === 3) return passengers.every((p) => p.pickupCoords && p.destCoords);
    if (step === 4) return !!(shifts[0]?.goTime) && selectedDays.length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canNext()) {
      toast({
        title: "يرجى إكمال الحقول المطلوبة",
        description: step === 3
          ? "تأكد من تحديد موقع الانطلاق والوصول لجميع الركاب"
          : step === 4
            ? "حدد وقت الذهاب وأيام العمل على الأقل"
            : "تأكد من تعبئة جميع المعلومات المطلوبة",
        variant: "destructive",
      });
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleSubmit = () => {
    const validShifts = buildShiftsPayload(shifts);
    const firstGoTime = shifts[0]?.goTime ?? "";
    const firstReturnTime = shifts[0]?.returnTime ?? "";

    const passengersData = passengers.map((p, idx) => ({
      passengerIndex: idx + 1,
      pickupLat: p.pickupCoords?.lat ?? null,
      pickupLng: p.pickupCoords?.lng ?? null,
      destinationLat: p.destCoords?.lat ?? null,
      destinationLng: p.destCoords?.lng ?? null,
      pickupAddress: p.pickupCoords?.address ?? null,
      destinationAddress: p.destCoords?.address ?? null,
      workTime: firstGoTime || null,
      daysPerWeek: selectedDays.length,
    }));

    createRequest.mutate(
      {
        data: {
          clientType: clientType as any,
          homeLocation: homeCoords?.address || "",
          workLocation: workCoords?.address || "",
          homeLat: homeCoords?.lat,
          homeLng: homeCoords?.lng,
          destLat: workCoords?.lat,
          destLng: workCoords?.lng,
          distanceKm: routeSummary?.distanceKm,
          numberOfPeople,
          workingDaysPerWeek: selectedDays.length,
          numberOfShifts: validShifts.length || 1,
          morningTime: firstGoTime,
          eveningTime: firstReturnTime || undefined,
          shifts: validShifts.length > 0 ? validShifts : undefined,
          passengers: passengersData,
        } as any,
      },
      {
        onSuccess: (req) => {
          localStorage.removeItem("createRequestDraft");
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم إنشاء الطلب بنجاح!", description: `طلب رقم #${req.id}` });
          setLocation(`/client/request/${req.id}`);
        },
        onError: () => {
          toast({
            title: "عذراً، حدث خطأ",
            description: "حاول مرة أخرى أو تواصل معنا للمساعدة",
            variant: "destructive",
          });
        },
      }
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout role="client">
      <div dir="rtl" className="min-h-screen flex flex-col pb-36">
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black"
              style={{ color: "var(--text-sub)", backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}
            >
              <ArrowLeft size={16} /> رجوع
            </button>
          ) : (
            <Link
              href="/client"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black"
              style={{ color: "var(--text-sub)", backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}
            >
              <ArrowLeft size={16} /> إلغاء
            </Link>
          )}
          <p className="text-sm font-black" style={{ color: "var(--text-hint)" }}>
            {step} / {TOTAL_STEPS}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-4 mb-6">
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: "var(--border-subtle)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ backgroundColor: "var(--brand)", width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Live price badge — shown on steps 3-5 once locations are set */}
        {step >= 3 && (homeCoords || isPricingLoading) && (
          <div className="px-4 mb-4">
            <PriceBadge
              isPricingLoading={isPricingLoading}
              pricingResult={pricingResult}
              routeSummary={routeSummary}
              numberOfPeople={numberOfPeople}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-4 space-y-5">

          {/* ── Step 1: Client Type ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  اختر نوع الاشتراك
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  حدد الفئة المناسبة لك
                </p>
              </div>
              <div className="space-y-3">
                {CLIENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setClientType(type.value)}
                    className="w-full flex items-center justify-between p-5 rounded-2xl transition-all active:scale-[0.98]"
                    style={
                      clientType === type.value
                        ? { backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }
                        : { backgroundColor: "var(--surface)", border: "2px solid var(--border-subtle)" }
                    }
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{type.emoji}</span>
                      <span className="text-lg font-black" style={{ color: "var(--text)" }}>
                        {type.label}
                      </span>
                    </div>
                    {clientType === type.value && (
                      <Check size={24} style={{ color: "var(--brand)" }} strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Number of People ── */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  عدد الأشخاص
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  كم عدد الأشخاص في الاشتراك؟
                </p>
                <p className="text-sm font-bold mt-2" style={{ color: "var(--text-hint)" }}>
                  💡 في الخطوة التالية ستحدد مواقع كل راكب على الخريطة مباشرة
                </p>
              </div>
              <div className="flex items-center justify-center gap-8 py-8">
                <button
                  onClick={() => handleSetNumberOfPeople(numberOfPeople - 1)}
                  className="w-16 h-16 rounded-full text-3xl font-black transition-all active:scale-90"
                  style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
                >
                  −
                </button>
                <div className="text-center">
                  <p className="text-6xl font-black" style={{ color: "var(--brand)" }}>
                    {numberOfPeople}
                  </p>
                  <p className="text-sm font-bold mt-2" style={{ color: "var(--text-muted)" }}>
                    {numberOfPeople === 1 ? "شخص واحد" : `${numberOfPeople} أشخاص`}
                  </p>
                </div>
                <button
                  onClick={() => handleSetNumberOfPeople(numberOfPeople + 1)}
                  className="w-16 h-16 rounded-full text-3xl font-black transition-all active:scale-90"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  +
                </button>
              </div>
              <p className="text-center text-sm font-bold" style={{ color: "var(--text-hint)" }}>
                من 1 إلى {MAX_PASSENGERS} أشخاص
              </p>
            </div>
          )}

          {/* ── Step 3: Locations (one card per passenger) ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  تحديد المواقع
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  ابحث عن اسم الحي أو المكان لكل راكب
                </p>
                <p className="text-sm font-bold mt-2 p-3 rounded-xl" style={{ color: "var(--text-hint)", backgroundColor: "var(--surface-2)" }}>
                  💡 اكتب اسم الحي أو المستشفى أو المدرسة في خانة البحث وستظهر لك اقتراحات، ثم اضغط تأكيد الموقع
                </p>
              </div>

              {passengers.map((p, idx) => (
                <PassengerCard
                  key={idx}
                  index={idx + 1}
                  passenger={p}
                  onChange={(updated) => updatePassenger(idx, updated)}
                />
              ))}
            </div>
          )}

          {/* ── Step 4: Shifts + Days ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  الأوقات والأيام
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  حدد أوقات الذهاب والعودة، ويمكنك إضافة أكثر من وردية
                </p>
              </div>

              {/* Shifts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black flex items-center gap-2" style={{ color: "var(--text-sub)" }}>
                    <Clock size={14} style={{ color: "var(--brand)" }} /> الورديات / الأوقات
                  </label>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
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
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed text-sm font-black transition-all active:scale-[0.98]"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    <Plus size={16} /> إضافة وردية أخرى
                  </button>
                )}
              </div>

              {/* Days */}
              <div className="space-y-3">
                <label className="text-sm font-black flex items-center gap-2" style={{ color: "var(--text-sub)" }}>
                  <Calendar size={14} style={{ color: "var(--brand)" }} /> أيام العمل
                </label>
                <div className="space-y-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.key}
                      onClick={() => toggleDay(day.key)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl transition-all active:scale-[0.98]"
                      style={
                        selectedDays.includes(day.key)
                          ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                          : { backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }
                      }
                    >
                      <span className="text-base font-black">{day.label}</span>
                      {selectedDays.includes(day.key) && <Check size={20} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                  {selectedDays.length} {selectedDays.length === 1 ? "يوم" : "أيام"} في الأسبوع
                </p>
              </div>
            </div>
          )}

          {/* ── Step 5: Summary ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  🎉 تقريباً انتهينا!
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  راجع تفاصيل طلبك قبل الإرسال
                </p>
              </div>

              {/* Type + people */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl flex items-start justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>نوع الاشتراك</p>
                    <p className="text-base font-black" style={{ color: "var(--text)" }}>
                      {CLIENT_TYPES.find(t => t.value === clientType)?.label}
                    </p>
                  </div>
                  <button onClick={() => setStep(1)} className="p-1.5 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    <Edit3 size={14} />
                  </button>
                </div>
                <div className="p-4 rounded-2xl flex items-start justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>عدد الأشخاص</p>
                    <p className="text-base font-black flex items-center gap-1" style={{ color: "var(--text)" }}>
                      <Users size={14} /> {numberOfPeople}
                    </p>
                  </div>
                  <button onClick={() => setStep(2)} className="p-1.5 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {/* Locations */}
              <div className="p-4 rounded-2xl space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black" style={{ color: "var(--text-muted)" }}>المواقع</p>
                  <button onClick={() => setStep(3)} className="p-1.5 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    <Edit3 size={14} />
                  </button>
                </div>
                {passengers.map((p, idx) => (
                  <div key={idx} className="space-y-1 py-2" style={{ borderTop: idx > 0 ? "1px solid var(--border-subtle)" : undefined }}>
                    {numberOfPeople > 1 && (
                      <p className="text-xs font-black" style={{ color: "var(--text-hint)" }}>الراكب {idx + 1}</p>
                    )}
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                      <Home size={12} className="inline-block ml-1" style={{ color: "var(--brand)" }} />
                      {p.pickupCoords?.address}
                    </p>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                      <Briefcase size={12} className="inline-block ml-1" style={{ color: "#F59E0B" }} />
                      {p.destCoords?.address}
                    </p>
                  </div>
                ))}
              </div>

              {/* Shifts */}
              <div className="p-4 rounded-2xl space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black" style={{ color: "var(--text-muted)" }}>الأوقات والأيام</p>
                  <button onClick={() => setStep(4)} className="p-1.5 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    <Edit3 size={14} />
                  </button>
                </div>
                {buildShiftsPayload(shifts).map((s, idx) => (
                  <p key={idx} className="text-sm font-bold" style={{ color: "var(--text)" }}>
                    {s.label}: {s.goTime} {s.returnTime ? `← ${s.returnTime}` : ""}
                  </p>
                ))}
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                  📅 {selectedDays.length} أيام في الأسبوع
                </p>
              </div>

              {/* Pricing */}
              {isPricingLoading && (
                <div className="p-5 rounded-2xl flex items-center gap-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <Loader2 size={20} className="animate-spin shrink-0" style={{ color: "var(--brand)" }} />
                  <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>جاري حساب السعر...</p>
                </div>
              )}
              {pricingResult && !pricingResult.needsAdminReview && (
                <div className="p-6 rounded-2xl space-y-3" style={{ backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }}>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>السعر الشهري</p>
                  <p className="text-4xl font-black" style={{ color: "var(--brand)" }}>
                    {pricingResult.pricePerPerson.toLocaleString("ar-SA")} ر.س
                    <span className="text-base font-bold mr-2" style={{ color: "var(--text-hint)" }}>/ شهر للشخص</span>
                  </p>
                  {numberOfPeople > 1 && (
                    <p className="text-lg font-black" style={{ color: "var(--text-sub)" }}>
                      الإجمالي: {pricingResult.price.toLocaleString("ar-SA")} ر.س
                    </p>
                  )}
                  {routeSummary && (
                    <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--brand-border)" }}>
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>المسافة</p>
                        <p className="text-lg font-black" style={{ color: "var(--text)" }}>{routeSummary.distanceKm.toFixed(1)} كم</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>المدة التقريبية</p>
                        <p className="text-lg font-black" style={{ color: "var(--text)" }}>{Math.round(routeSummary.durationMinutes)} دقيقة</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {pricingResult?.needsAdminReview && (
                <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                    سيتم مراجعة السعر من قبل الإدارة وإبلاغك
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        <div
          className="fixed bottom-0 inset-x-0 p-4 z-50"
          style={{
            background: "linear-gradient(180deg, transparent 0%, var(--bg) 25%)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          }}
        >
          <button
            onClick={handleNext}
            disabled={!canNext() || createRequest.isPending}
            className="w-full rounded-2xl p-5 text-xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-fg)",
              boxShadow: "var(--brand-shadow)",
              minHeight: "64px",
            }}
          >
            {step === TOTAL_STEPS ? (
              createRequest.isPending ? "جاري الإرسال..." : <><CheckCircle2 size={24} /> إرسال الطلب</>
            ) : (
              "التالي →"
            )}
          </button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
            onClick={() => setShowConfirmDialog(false)}
          >
            <div
              className="w-full max-w-md p-6 rounded-3xl space-y-6 animate-in fade-in zoom-in-95 duration-200"
              style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>هل أنت متأكد؟</h2>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  سيتم إرسال طلبك للمراجعة. يمكنك التعديل عليه لاحقاً.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => { setShowConfirmDialog(false); handleSubmit(); }}
                  disabled={createRequest.isPending}
                  className="w-full rounded-2xl p-5 text-xl font-black flex items-center justify-center gap-3"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  <CheckCircle2 size={24} />
                  {createRequest.isPending ? "جاري الإرسال..." : "نعم، أرسل الطلب"}
                </button>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="w-full rounded-2xl p-4 text-lg font-black"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
                >
                  مراجعة البيانات
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
