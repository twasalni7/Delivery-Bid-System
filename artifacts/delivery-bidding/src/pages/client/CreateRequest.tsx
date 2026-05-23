import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { buildShiftsPayload } from "@/lib/time-utils";
import MapPicker, { type MapCoords } from "@/components/MapPicker";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { ArrowLeft, Check, MapPin, Clock, Calendar, CheckCircle2, Edit3 } from "lucide-react";

// Types
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

export default function CreateRequestNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  // Current step (1-7)
  const [step, setStep] = useState(1);

  // Step 1: Client type
  const [clientType, setClientType] = useState("");

  // Step 2: Number of people
  const [numberOfPeople, setNumberOfPeople] = useState(1);

  // Step 3: Pickup location
  const [homeCoords, setHomeCoords] = useState<MapCoords | null>(null);

  // Step 4: Dropoff location
  const [workCoords, setWorkCoords] = useState<MapCoords | null>(null);

  // Step 5: Go time
  const [goTime, setGoTime] = useState("");

  // Step 6: Return time (optional)
  const [hasReturn, setHasReturn] = useState<boolean>(false);
  const [returnTime, setReturnTime] = useState("");

  // Step 7: Days
  const [selectedDays, setSelectedDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem("createRequestDraft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.clientType) setClientType(parsed.clientType);
        if (parsed.numberOfPeople) setNumberOfPeople(parsed.numberOfPeople);
        if (parsed.homeCoords) setHomeCoords(parsed.homeCoords);
        if (parsed.workCoords) setWorkCoords(parsed.workCoords);
        if (parsed.goTime) setGoTime(parsed.goTime);
        if (parsed.hasReturn !== undefined) setHasReturn(parsed.hasReturn);
        if (parsed.returnTime) setReturnTime(parsed.returnTime);
        if (parsed.selectedDays) setSelectedDays(parsed.selectedDays);
        if (parsed.step) setStep(parsed.step);

        toast({
          title: "تم استعادة المسودة",
          description: "وجدنا طلب لم يكتمل، تم استعادة بياناتك"
        });
      } catch (e) {
        // Invalid draft, ignore
        console.error("Failed to parse draft", e);
      }
    }
  }, [toast]);

  // Auto-save draft to localStorage
  useEffect(() => {
    const draft = {
      clientType,
      numberOfPeople,
      homeCoords,
      workCoords,
      goTime,
      hasReturn,
      returnTime,
      selectedDays,
      step,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("createRequestDraft", JSON.stringify(draft));
  }, [clientType, numberOfPeople, homeCoords, workCoords, goTime, hasReturn, returnTime, selectedDays, step]);

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

  // Fetch pricing when locations are ready
  useEffect(() => {
    if (!homeCoords || !workCoords) {
      setRouteSummary(undefined);
      setPricingResult(undefined);
      return;
    }
    const controller = new AbortController();
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
            numberOfShifts: 1,
            eveningTime: returnTime || undefined,
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
  }, [homeCoords, workCoords, numberOfPeople, selectedDays, returnTime]);

  const toggleDay = (key: string) =>
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );

  const canNext = () => {
    if (step === 1) return !!clientType;
    if (step === 2) return numberOfPeople >= 1;
    if (step === 3) return !!homeCoords;
    if (step === 4) return !!workCoords;
    if (step === 5) return !!goTime;
    if (step === 6) return !hasReturn || (hasReturn && !!returnTime);
    if (step === 7) return selectedDays.length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canNext()) {
      toast({
        title: "يرجى إكمال الحقول المطلوبة",
        description: "تأكدي من تعبئة جميع المعلومات المطلوبة",
        variant: "destructive"
      });
      return;
    }
    if (step < 8) {
      setStep(step + 1);
    } else {
      // Show confirmation dialog before submitting
      setShowConfirmDialog(true);
    }
  };

  const handleSubmit = () => {
    const validShifts = buildShiftsPayload([{ goTime, returnTime: returnTime || "" }]);
    const passengersData = [{
      passengerIndex: 1,
      pickupLat: homeCoords?.lat ?? null,
      pickupLng: homeCoords?.lng ?? null,
      destinationLat: workCoords?.lat ?? null,
      destinationLng: workCoords?.lng ?? null,
      pickupAddress: homeCoords?.address || null,
      destinationAddress: workCoords?.address || null,
      workTime: goTime || null,
      daysPerWeek: selectedDays.length,
    }];

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
          morningTime: goTime,
          eveningTime: returnTime || undefined,
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
        onError: (err: Error) => {
          toast({
            title: "عذراً، حدث خطأ بسيط",
            description: "حاولي مرة أخرى أو تواصلي معنا للمساعدة",
            variant: "destructive"
          });
        },
      }
    );
  };

  return (
    <Layout role="client">
      <div dir="rtl" className="min-h-screen flex flex-col pb-32">
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
            {step} / 8
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-4 mb-6">
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "var(--border-subtle)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ backgroundColor: "var(--brand)", width: `${(step / 8) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4">
          {/* Step 1: Client Type */}
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

          {/* Step 2: Number of People */}
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
                  💡 نحتاج هذه المعلومة لحساب السعر المناسب لك
                </p>
              </div>
              <div className="flex items-center justify-center gap-8 py-12">
                <button
                  onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
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
                  onClick={() => setNumberOfPeople(Math.min(MAX_PASSENGERS, numberOfPeople + 1))}
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

          {/* Step 3: Pickup Location */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  موقع الانطلاق
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  ابحثي عن العنوان أو حددي الموقع من الخريطة مباشرة
                </p>
              </div>
              <div className="space-y-4">
                {!homeCoords && (
                  <div className="space-y-3">
                    <MapPicker
                      value={homeCoords}
                      onChange={(coords) => {
                        setHomeCoords(coords);
                        toast({
                          title: "رائع! 🎉",
                          description: "تم تحديد موقع الانطلاق بنجاح"
                        });
                      }}
                      placeholder="حدد موقع الانطلاق من الخريطة"
                      color="var(--brand)"
                      openButtonLabel="حدد موقع الانطلاق"
                      openButtonHint="ابحث أو حدد من الخريطة"
                      collapsible={false}
                    />
                  </div>
                )}
                {homeCoords && (
                  <div className="space-y-3">
                    <div className="p-5 rounded-2xl" style={{ backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }}>
                      <div className="flex items-start gap-3">
                        <Check size={24} style={{ color: "var(--brand)" }} strokeWidth={3} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black mb-1" style={{ color: "var(--brand)" }}>✓ تم التحديد بنجاح</p>
                          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>
                            {homeCoords.address}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setHomeCoords(null)}
                      className="w-full p-3 rounded-xl text-sm font-black"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
                    >
                      تغيير الموقع
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Dropoff Location */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  موقع الوصول
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  ابحثي عن وجهتك أو حدديها من الخريطة
                </p>
              </div>
              <div className="space-y-4">
                {!workCoords && (
                  <div className="space-y-3">
                    <MapPicker
                      value={workCoords}
                      onChange={(coords) => {
                        setWorkCoords(coords);
                        toast({
                          title: "ممتاز! 🎯",
                          description: "تم تحديد موقع الوصول بنجاح"
                        });
                      }}
                      placeholder="حدد موقع الوصول من الخريطة"
                      color="var(--brand)"
                      initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
                      openButtonLabel="حدد موقع الوصول"
                      openButtonHint="ابحث أو حدد من الخريطة"
                      collapsible={false}
                    />
                  </div>
                )}
                {workCoords && (
                  <div className="space-y-3">
                    <div className="p-5 rounded-2xl" style={{ backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }}>
                      <div className="flex items-start gap-3">
                        <Check size={24} style={{ color: "var(--brand)" }} strokeWidth={3} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black mb-1" style={{ color: "var(--brand)" }}>✓ تم التحديد بنجاح</p>
                          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>
                            {workCoords.address}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setWorkCoords(null)}
                      className="w-full p-3 rounded-xl text-sm font-black"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
                    >
                      تغيير الموقع
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Go Time */}
          {step === 5 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  وقت الذهاب
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  متى تحتاج التوصيل في الصباح؟
                </p>
                <p className="text-sm font-bold mt-2" style={{ color: "var(--text-hint)" }}>
                  ⏰ سيحاول السائق التواجد قبل الوقت المحدد بـ 5-10 دقائق
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 py-12">
                <Clock size={32} style={{ color: "var(--brand)" }} />
                <Input
                  type="time"
                  value={goTime}
                  onChange={(e) => setGoTime(e.target.value)}
                  className="text-center text-4xl font-black p-8 rounded-2xl"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "2px solid var(--brand)",
                    color: "var(--brand)",
                    minHeight: "120px"
                  }}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Step 6: Return */}
          {step === 6 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  هل يوجد عودة؟
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  هل تحتاج توصيل عودة في المساء؟
                </p>
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    if (hasReturn) {
                      setHasReturn(false);
                      setReturnTime("");
                    } else {
                      setHasReturn(true);
                    }
                  }}
                  className="w-full p-6 rounded-2xl text-xl font-black transition-all active:scale-[0.98]"
                  style={
                    hasReturn
                      ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                      : { backgroundColor: "var(--surface)", border: "2px solid var(--border)", color: "var(--text)" }
                  }
                >
                  {hasReturn && <Check size={24} className="inline-block ml-2" />}
                  نعم، يوجد عودة
                </button>

                {/* Show time picker when hasReturn is true */}
                {hasReturn && (
                  <div className="p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300"
                    style={{ backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }}
                  >
                    <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                      حدد وقت العودة:
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <Clock size={32} style={{ color: "var(--brand)" }} />
                      <Input
                        type="time"
                        value={returnTime}
                        onChange={(e) => setReturnTime(e.target.value)}
                        className="text-center text-3xl font-black p-6 rounded-2xl"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "2px solid var(--brand)",
                          color: "var(--brand)",
                          minHeight: "100px"
                        }}
                        dir="ltr"
                        placeholder="وقت العودة"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setHasReturn(false);
                    setReturnTime("");
                  }}
                  className="w-full p-6 rounded-2xl text-xl font-black transition-all active:scale-[0.98]"
                  style={
                    hasReturn === false
                      ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                      : { backgroundColor: "var(--surface)", border: "2px solid var(--border)", color: "var(--text)" }
                  }
                >
                  {hasReturn === false && <Check size={24} className="inline-block ml-2" />}
                  لا، ذهاب فقط
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Days */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  أيام العمل
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  اختر الأيام التي تحتاج فيها التوصيل
                </p>
                <p className="text-sm font-bold mt-2" style={{ color: "var(--text-hint)" }}>
                  📅 يمكنك اختيار أي عدد من الأيام حسب احتياجك
                </p>
              </div>
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => toggleDay(day.key)}
                    className="w-full flex items-center justify-between p-5 rounded-2xl transition-all active:scale-[0.98]"
                    style={
                      selectedDays.includes(day.key)
                        ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                        : { backgroundColor: "var(--surface)", border: "2px solid var(--border)", color: "var(--text)" }
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={20} />
                      <span className="text-lg font-black">{day.label}</span>
                    </div>
                    {selectedDays.includes(day.key) && <Check size={24} strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <p className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                {selectedDays.length} {selectedDays.length === 1 ? "يوم" : "أيام"} في الأسبوع
              </p>
            </div>
          )}

          {/* Step 8: Summary */}
          {step === 8 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black mb-2" style={{ color: "var(--text)" }}>
                  🎉 تقريباً انتهينا!
                </h1>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  راجع تفاصيل طلبك قبل الإرسال
                </p>
                <p className="text-sm font-bold mt-2" style={{ color: "var(--text-hint)" }}>
                  💡 يمكنك التعديل على أي معلومة بالضغط على أيقونة القلم
                </p>
              </div>
              <div className="space-y-3">
                <div className="p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>نوع الاشتراك</p>
                    <p className="text-lg font-black" style={{ color: "var(--text)" }}>
                      {CLIENT_TYPES.find(t => t.value === clientType)?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                    aria-label="تعديل نوع الاشتراك"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                <div className="p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>عدد الأشخاص</p>
                    <p className="text-lg font-black" style={{ color: "var(--text)" }}>{numberOfPeople}</p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                    aria-label="تعديل عدد الأشخاص"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                <div className="p-5 rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>المواقع</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep(3)}
                        className="p-2 rounded-xl transition-all active:scale-90"
                        style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                        aria-label="تعديل موقع الانطلاق"
                      >
                        <Edit3 size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>من: {homeCoords?.address}</p>
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>إلى: {workCoords?.address}</p>
                </div>
                <div className="p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>الأوقات</p>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                      الذهاب: {goTime} {returnTime && `• العودة: ${returnTime}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(5)}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                    aria-label="تعديل الأوقات"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                <div className="p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>أيام العمل</p>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{selectedDays.length} أيام في الأسبوع</p>
                  </div>
                  <button
                    onClick={() => setStep(7)}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}
                    aria-label="تعديل أيام العمل"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                {isPricingLoading && (
                  <div className="p-6 rounded-2xl text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                      ⏳ جاري حساب السعر...
                    </p>
                  </div>
                )}
                {pricingResult && !pricingResult.needsAdminReview && (
                  <div className="p-6 rounded-2xl space-y-3" style={{ backgroundColor: "var(--brand-subtle)", border: "2px solid var(--brand)" }}>
                    <div>
                      <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>السعر الشهري</p>
                      <p className="text-4xl font-black" style={{ color: "var(--brand)" }}>
                        {pricingResult.pricePerPerson.toLocaleString("ar-SA")} ر.س
                      </p>
                      <p className="text-sm font-bold mt-1" style={{ color: "var(--text-hint)" }}>
                        للشخص الواحد شهرياً
                      </p>
                    </div>
                    {routeSummary && (
                      <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--brand-border)" }}>
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>المسافة</p>
                          <p className="text-lg font-black" style={{ color: "var(--text)" }}>
                            {routeSummary.distanceKm.toFixed(1)} كم
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>المدة التقريبية</p>
                          <p className="text-lg font-black" style={{ color: "var(--text)" }}>
                            {Math.round(routeSummary.durationMinutes)} دقيقة
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {pricingResult && pricingResult.needsAdminReview && (
                  <div className="p-6 rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-base font-bold text-center" style={{ color: "var(--text)" }}>
                      سيتم مراجعة السعر من قبل الإدارة
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Button */}
        <div
          className="fixed bottom-0 inset-x-0 p-4 z-50"
          style={{
            background: "linear-gradient(180deg, transparent 0%, var(--bg) 20%)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)"
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
              minHeight: "64px"
            }}
          >
            {step === 8 ? (
              createRequest.isPending ? (
                "جاري الإرسال..."
              ) : (
                <>
                  <CheckCircle2 size={24} /> إرسال الطلب
                </>
              )
            ) : (
              "التالي"
            )}
          </button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
            onClick={() => setShowConfirmDialog(false)}
          >
            <div
              className="w-full max-w-md p-6 rounded-3xl space-y-6 animate-in fade-in zoom-in-95 duration-200"
              style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
                  هل أنت متأكد؟
                </h2>
                <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>
                  سيتم إرسال طلبك للمراجعة. يمكنك التعديل عليه لاحقاً إذا احتجت.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    handleSubmit();
                  }}
                  disabled={createRequest.isPending}
                  className="w-full rounded-2xl p-5 text-xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-fg)"
                  }}
                >
                  <CheckCircle2 size={24} />
                  {createRequest.isPending ? "جاري الإرسال..." : "نعم، أرسل الطلب"}
                </button>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="w-full rounded-2xl p-4 text-lg font-black transition-all active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-sub)"
                  }}
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
