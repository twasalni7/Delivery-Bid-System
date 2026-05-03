import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/time-utils";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { ArrowRight, Plus, X, Home, Briefcase, Users, Clock, CheckCircle2, Check } from "lucide-react";

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

type AdditionalLocation = { type: "pickup" | "dropoff"; address: string };

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

export default function AdminCreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [clientType, setClientType] = useState("موظفات");

  // Step 2
  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
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
  const [monthlyPrice, setMonthlyPrice] = useState("");

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
    if (step === 2) return homeLocation.trim() && workLocation.trim();
    if (step === 3) return morningTime && selectedDays.length > 0;
    return phone.trim().length >= 10;
  };

  const handleSubmit = async () => {
    const validAdditional = additionalLocations.filter((l) => l.address.trim());
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/admin/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          clientType,
          homeLocation: homeLocation.trim(),
          workLocation: workLocation.trim(),
          additionalLocations: validAdditional.length > 0 ? validAdditional : undefined,
          phone: phone.trim(),
          numberOfPeople: parseInt(numberOfPeople) || 1,
          workingDaysPerWeek: selectedDays.length,
          numberOfShifts: eveningTime ? 2 : 1,
          morningTime,
          eveningTime: eveningTime || undefined,
          notes: notes.trim() || undefined,
          monthlyPrice: monthlyPrice.trim() ? parseFloat(monthlyPrice) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل إضافة الطلب");
      queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
      toast({ title: "✅ تم إضافة الطلب!", description: `طلب رقم #${data.id} مفتوح الآن للسائقين.` });
      setLocation(`/admin/requests?request=${data.id}`);
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "فشل إضافة الطلب", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout role="admin">
      <div dir="rtl" className="max-w-xl mx-auto pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/requests" className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors" style={{ color: "var(--text-muted)" }}>
            <ArrowRight size={15} /> العودة للطلبات
          </Link>
        </div>

        {/* Page title */}
        <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black mb-3" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
              🛡️ إنشاء من الإدارة
            </div>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none text-white">طلب توصيل جديد</h1>
            <p className="font-bold text-sm mt-1" style={{ color: "var(--text-muted)" }}>تُنشئه الإدارة نيابةً عن العميل — نفس الخطوات تماماً</p>
          </div>

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
                  <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>📍 موقع الانطلاق (المنزل)</label>
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] transition-colors" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
                    <Home className="shrink-0" size={22} style={{ color: "var(--brand)" }} />
                    <Input
                      type="text"
                      placeholder="مثال: حي الروضة، شارع التحلية..."
                      value={homeLocation}
                      onChange={(e) => setHomeLocation(e.target.value)}
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-base font-bold p-0 h-auto"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black pr-1" style={{ color: "var(--text-sub)" }}>📍 موقع الوصول (الدوام)</label>
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] transition-colors" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)" }}>
                    <Briefcase className="text-rose-500 shrink-0" size={22} />
                    <Input
                      type="text"
                      placeholder="مثال: مستشفى الملك فهد، الرياض..."
                      value={workLocation}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-base font-bold p-0 h-auto"
                    />
                  </div>
                </div>

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
                      style={{ color: "#f87171", backgroundColor: "rgba(239,68,68,0.08)" }}
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
                <div className="space-y-2">
                  <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>💰 السعر الشهري (ريال) *</label>
                  <div className="relative">
                    <Input
                      type="number" min="1" step="1"
                      placeholder="مثال: 800"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(e.target.value)}
                      className="rounded-2xl text-xl font-black pl-14 h-14 input-dark"
                      dir="ltr"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black" style={{ color: "var(--text-hint)" }}>ر.س</span>
                  </div>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>السعر الذي سيدفعه العميل شهرياً للسائق</p>
                </div>

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
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>أيام العمل</span><span className="font-black">{selectedDays.length} أيام</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-sub)" }}>
                    <span>الركاب</span><span className="font-black">{numberOfPeople} أشخاص</span>
                  </div>
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
              disabled={submitting}
              className="flex-1 font-black py-4 rounded-[1.5rem] text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "0 18px 36px var(--brand-border)" }}
            >
              {step === 4 ? (
                submitting ? "جاري الإرسال..." : <><CheckCircle2 size={20} /> نشر الطلب للسائقين</>
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
