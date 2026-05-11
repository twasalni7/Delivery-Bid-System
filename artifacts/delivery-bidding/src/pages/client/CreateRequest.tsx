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
  CheckCircle2, Check, Share2, Lock, GraduationCap, Building2, Package, School,
} from "lucide-react";

const CLIENT_TYPES = [
  { value: "طلاب", icon: GraduationCap, label: "طلاب", color: "#4A90E2" },
  { value: "موظفات", icon: Briefcase, label: "موظفات", color: "#9B59B6" },
  { value: "خدمات", icon: Building2, label: "خدمات", color: "#E67E22" },
  { value: "مدارس", icon: School, label: "مدارس", color: "#1ABC9C" },
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

/** Maximum number of passengers supported per request */
const MAX_PASSENGERS = 10;

/** Single shift editor card */
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
    <div className="rounded-2xl p-4 space-y-3 bg-white border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">
          {SHIFT_LABELS[index] ?? `الوردية ${index + 1}`}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-xl transition-colors text-red-600 bg-red-50 hover:bg-red-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500">وقت الذهاب</label>
          <Input
            type="time"
            value={shift.goTime}
            onChange={(e) => onChange({ ...shift, goTime: e.target.value })}
            className="rounded-xl font-bold text-base"
            dir="ltr"
          />
          {shift.goTime && (
            <p className="text-xs font-bold text-blue-600">{formatTime12hLong(shift.goTime)}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500">وقت العودة</label>
          <Input
            type="time"
            value={shift.returnTime}
            onChange={(e) => onChange({ ...shift, returnTime: e.target.value })}
            className="rounded-xl font-bold text-base"
            dir="ltr"
          />
          {shift.returnTime && (
            <p className="text-xs font-bold text-gray-600">{formatTime12hLong(shift.returnTime)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreateRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createRequest = useCreateRequest();

  // Form state
  const [clientType, setClientType] = useState("");
  const [sharingCount, setSharingCount] = useState(1);
  const [subscriptionType, setSubscriptionType] = useState<"shared" | "private">("shared");

  // Main passenger (Passenger 1)
  const [homeCoords, setHomeCoords] = useState<MapCoords | null>(null);
  const [homeLocation, setHomeLocation] = useState("");
  const [workCoords, setWorkCoords] = useState<MapCoords | null>(null);
  const [workLocation, setWorkLocation] = useState("");
  const [workTime, setWorkTime] = useState("");

  // Extra passengers (2+)
  const [extraPassengers, setExtraPassengers] = useState<ExtraPassenger[]>([]);

  // Additional locations
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);

  // Schedule
  const [shifts, setShifts] = useState<ShiftEntry[]>([{ goTime: "", returnTime: "" }]);
  const [selectedDays, setSelectedDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);

  // Contact & notes
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-pricing state
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingResult, setPricingResult] = useState<{
    price: number;
    pricePerPerson: number;
    needsAdminReview: boolean;
  } | null>(null);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    durationMinutes: number;
  } | null>(null);

  // Auto-calculate price when locations/passengers change
  const fetchPricing = useCallback(async () => {
    if (!homeCoords || !workCoords || sharingCount < 1) {
      setPricingResult(null);
      setRouteSummary(null);
      return;
    }

    setIsPricingLoading(true);
    try {
      const res = await fetch(`${API}/api/requests/resolve-routing-and-pricing`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: homeCoords.lat,
          pickupLng: homeCoords.lng,
          destLat: workCoords.lat,
          destLng: workCoords.lng,
          passengerCount: sharingCount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPricingResult({
          price: data.monthlyPrice,
          pricePerPerson: data.monthlyPricePerPerson,
          needsAdminReview: data.needsAdminReview,
        });
        setRouteSummary({
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
        });
      } else {
        setPricingResult(null);
        setRouteSummary(null);
      }
    } catch (err) {
      console.error("Failed to fetch pricing:", err);
    } finally {
      setIsPricingLoading(false);
    }
  }, [homeCoords, workCoords, sharingCount]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleSubmit = async () => {
    if (!clientType || !phone || !homeCoords || !workCoords || !shifts[0]?.goTime) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

    try {
      await createRequest.mutateAsync({
        data: {
          clientType: clientType as any,
          homeLocation,
          workLocation,
          homeLat: homeCoords.lat,
          homeLng: homeCoords.lng,
          destLat: workCoords.lat,
          destLng: workCoords.lng,
          phone,
          numberOfPeople: sharingCount,
          workingDaysPerWeek: selectedDays.length,
          morningTime: shifts[0].goTime,
          eveningTime: shifts[0].returnTime || undefined,
          shifts: buildShiftsPayload(shifts),
          notes: notes.trim() || undefined,
          additionalLocations: additionalLocations
            .filter((l) => l.address.trim())
            .map((l) => ({ type: l.type as any, address: l.address })),
        },
      });

      toast({ title: "تم نشر الطلب بنجاح!", description: "سيتم إعلامك عند استلام عروض من السائقين" });
      await queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      navigate("/client/requests");
    } catch (error: any) {
      toast({
        title: "فشل نشر الطلب",
        description: error?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout role="client">
      <div className="min-h-screen bg-gray-50 pb-20" dir="rtl" style={{ fontFamily: "var(--font-arabic)" }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-black text-gray-800">اشتراك شهري جديد</h1>
          <p className="text-sm text-gray-500 mt-1">املأ البيانات واحصل على عروض من السائقين</p>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
          {/* Section 1: Subscription Type */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-black">1</div>
              <h2 className="text-lg font-black text-gray-800">نوع الاشتراك</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CLIENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = clientType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setClientType(type.value)}
                    className={`rounded-2xl p-4 text-center transition-all ${
                      isSelected
                        ? "bg-white border-2 shadow-md scale-105"
                        : "bg-white border border-gray-200 hover:border-gray-300"
                    }`}
                    style={isSelected ? { borderColor: type.color } : {}}
                  >
                    <div
                      className="w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: isSelected ? type.color : "#f3f4f6" }}
                    >
                      <Icon size={24} style={{ color: isSelected ? "white" : "#6b7280" }} />
                    </div>
                    <p className="text-sm font-bold text-gray-700">{type.label}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Locations */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-black">2</div>
              <h2 className="text-lg font-black text-gray-800">المواقع</h2>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <label className="text-sm font-bold text-gray-600 mb-2 block">موقع الانطلاق (المنزل)</label>
                <p className="text-xs text-gray-500 mb-2">مثال: حي النرجس، الرياض</p>
                <MapPicker
                  value={homeCoords}
                  initialCenter={homeCoords ? [homeCoords.lat, homeCoords.lng] : undefined}
                  onChange={(coords) => {
                    setHomeCoords(coords);
                    setHomeLocation(coords.address);
                  }}
                />
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200">
                <label className="text-sm font-bold text-gray-600 mb-2 block">موقع الوصول (العمل/المدرسة)</label>
                <p className="text-xs text-gray-500 mb-2">مثال: طريق الملك فهد، برج المملكة</p>
                <MapPicker
                  value={workCoords}
                  initialCenter={calculateDropoffMapCenter(homeCoords, workCoords)}
                  onChange={(coords) => {
                    setWorkCoords(coords);
                    setWorkLocation(coords.address);
                  }}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Schedule */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-black">3</div>
              <h2 className="text-lg font-black text-gray-800">الجدول الزمني</h2>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">وقت الذهاب</label>
                <Input
                  type="time"
                  value={shifts[0]?.goTime || ""}
                  onChange={(e) => {
                    const newShifts = [...shifts];
                    newShifts[0] = { ...newShifts[0], goTime: e.target.value };
                    setShifts(newShifts);
                  }}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">وقت العودة</label>
                <Input
                  type="time"
                  value={shifts[0]?.returnTime || ""}
                  onChange={(e) => {
                    const newShifts = [...shifts];
                    newShifts[0] = { ...newShifts[0], returnTime: e.target.value };
                    setShifts(newShifts);
                  }}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">أيام العمل</label>
                <div className="flex gap-2 justify-center">
                  {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDays(selectedDays.filter((d) => d !== day.key));
                          } else {
                            setSelectedDays([...selectedDays, day.key]);
                          }
                        }}
                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                          isSelected
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Contact Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-black">4</div>
              <h2 className="text-lg font-black text-gray-800">بيانات التواصل</h2>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">الاسم الكامل</label>
                <p className="text-xs text-gray-500 mb-2">مثال: سارة أحمد</p>
                <Input
                  placeholder="الاسم الكامل (اختياري)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-2 block">رقم الجوال *</label>
                <Input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">رقمك مخفي عن السائقين حتى تختار أحدهم</p>
              </div>
            </div>
          </section>

          {/* Price Display */}
          {isPricingLoading ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-sm font-bold text-blue-700">جاري حساب السعر...</p>
            </div>
          ) : pricingResult && !pricingResult.needsAdminReview ? (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-2xl p-5 space-y-2">
              <p className="text-sm font-bold text-gray-600">السعر الشهري التقديري</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-purple-600">
                  {pricingResult.pricePerPerson.toLocaleString("ar-SA")}
                </p>
                <p className="text-base font-bold text-gray-600">ر.س / شهر</p>
              </div>
              {routeSummary && (
                <p className="text-xs font-bold text-gray-500">
                  المسافة: {routeSummary.distanceKm.toFixed(1)} كم • الوقت: {routeSummary.durationMinutes.toFixed(0)} دقيقة
                </p>
              )}
            </div>
          ) : null}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={createRequest.isPending || !clientType || !phone || !homeCoords || !workCoords}
            className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              boxShadow: "0 10px 30px rgba(102, 126, 234, 0.3)",
            }}
          >
            {createRequest.isPending ? "جاري النشر..." : "نشر الطلب واحصل على عروض"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
