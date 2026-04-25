import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/time-utils";
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
      <div className="absolute left-8 right-8 h-1 top-1/2 -translate-y-1/2 -z-10 bg-slate-100 rounded-full" />
      <div
        className="absolute right-8 h-1 bg-[#312E81] top-1/2 -translate-y-1/2 -z-10 transition-all duration-700 rounded-full"
        style={{ left: "2rem", width: `${((currentStep - 1) / 3) * 100}%` }}
      />
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`w-5 h-5 rounded-full border-4 transition-all duration-500 shadow-md z-10 ${
            s <= currentStep
              ? "bg-[#312E81] border-[#312E81]"
              : "bg-white border-slate-200"
          }`}
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
    return phone.trim() && monthlyPrice.trim() && parseFloat(monthlyPrice) > 0;
  };

  const handleSubmit = () => {
    const validAdditional = additionalLocations.filter((l) => l.address.trim());
    createRequest.mutate(
      {
        data: {
          clientType: clientType as any,
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
          monthlyPrice: parseFloat(monthlyPrice),
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
        <Link href="/client" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-[#312E81] transition-colors mb-6">
          <ArrowRight size={15} /> العودة لاشتراكاتي
        </Link>

        <ProgressSteps currentStep={step} />

        <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-2xl shadow-slate-200/60 overflow-hidden">
          {/* Step header */}
          <div className="text-center px-8 pt-8 pb-6 border-b border-slate-50">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">المرحلة {step} من 4</p>
            <h2 className="text-[1.8rem] font-black text-[#0F172A] tracking-tight leading-none">{STEP_TITLES[step - 1]}</h2>
          </div>

          <div className="p-6 space-y-5">
            {/* ── Step 1: Subscription type ── */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3">
                {CLIENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setClientType(t.value)}
                    className={`flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all active:scale-[0.98] ${
                      clientType === t.value
                        ? "border-[#312E81] bg-indigo-50/50"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                          clientType === t.value ? "bg-[#312E81]" : "bg-white"
                        }`}
                      >
                        {clientType === t.value ? (
                          <Users size={22} className="text-white" />
                        ) : (
                          <span>{t.emoji}</span>
                        )}
                      </div>
                      <span className="text-[1.1rem] font-black text-[#0F172A]">{t.label}</span>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        clientType === t.value ? "border-[#312E81] bg-[#312E81]" : "border-slate-200"
                      }`}
                    >
                      {clientType === t.value && <Check size={12} strokeWidth={4} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Step 2: Route ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 pr-1">📍 موقع الانطلاق (المنزل)</label>
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 focus-within:border-[#312E81] transition-colors">
                    <Home className="text-[#312E81] shrink-0" size={22} />
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
                  <label className="text-sm font-black text-slate-500 pr-1">📍 موقع الوصول (الدوام)</label>
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 focus-within:border-[#312E81] transition-colors">
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
                          className="border-2 border-slate-100 rounded-2xl px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:border-[#312E81]"
                        >
                          <option value="pickup">استلام</option>
                          <option value="dropoff">توصيل</option>
                        </select>
                        <Input
                          placeholder="العنوان..."
                          value={loc.address}
                          onChange={(e) => updateLocation(idx, "address", e.target.value)}
                          className="flex-1 rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeLocation(idx)}
                      className="mt-2.5 p-2 text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addLocation}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-[1.5rem] border-2 border-dashed border-slate-200 text-sm font-black text-slate-400 hover:border-[#312E81] hover:text-[#312E81] transition-colors"
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
                    <label className="text-sm font-black text-slate-500">⏰ وقت الذهاب</label>
                    <Input
                      type="time"
                      value={morningTime}
                      onChange={(e) => setMorningTime(e.target.value)}
                      className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold text-base"
                      dir="ltr"
                    />
                    {morningTime && <p className="text-xs font-bold text-[#312E81]">{formatTime12h(morningTime)}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-500">⏰ وقت العودة</label>
                    <Input
                      type="time"
                      value={eveningTime}
                      onChange={(e) => setEveningTime(e.target.value)}
                      className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold text-base"
                      dir="ltr"
                    />
                    {eveningTime && <p className="text-xs font-bold text-[#312E81]">{formatTime12h(eveningTime)}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-500">أيام العمل</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d) => (
                      <button
                        key={d.key}
                        onClick={() => toggleDay(d.key)}
                        className={`w-10 h-10 rounded-full text-sm font-black transition-all active:scale-90 ${
                          selectedDays.includes(d.key)
                            ? "text-white shadow-md shadow-indigo-900/20"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                        style={
                          selectedDays.includes(d.key)
                            ? { background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }
                            : {}
                        }
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-bold text-slate-400">{selectedDays.length} أيام في الأسبوع</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500">👥 عدد الأشخاص</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setNumberOfPeople((p) => String(Math.max(1, parseInt(p) - 1)))}
                      className="w-10 h-10 rounded-full bg-slate-100 text-[#0F172A] font-black text-xl hover:bg-slate-200 transition-colors"
                    >−</button>
                    <span className="text-[1.8rem] font-black text-[#312E81] w-10 text-center">{numberOfPeople}</span>
                    <button
                      onClick={() => setNumberOfPeople((p) => String(Math.min(20, parseInt(p) + 1)))}
                      className="w-10 h-10 rounded-full bg-slate-100 text-[#0F172A] font-black text-xl hover:bg-slate-200 transition-colors"
                    >+</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500">ملاحظات للسائقين (اختياري)</label>
                  <Textarea
                    placeholder="مثال: يفضل سائقة، باص كبير..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Financial & Contact ── */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500">💰 السعر الشهري (ريال) *</label>
                  <div className="relative">
                    <Input
                      type="number" min="1" step="1"
                      placeholder="مثال: 800"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(e.target.value)}
                      className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] text-xl font-black pl-14 h-14"
                      dir="ltr"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-black">ر.س</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400">هذا هو السعر الذي ستدفعه شهرياً للسائق</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500">الاسم الكامل (اختياري)</label>
                  <Input
                    placeholder="مثال: سارة أحمد"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500">رقم الجوال *</label>
                  <Input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-2xl border-2 border-slate-100 focus:border-[#312E81] font-bold h-12"
                    dir="ltr"
                  />
                  <p className="text-xs font-bold text-slate-400">يُخفى عن السائقين حتى يتم اختيار أحدهم</p>
                </div>

                {/* Summary */}
                <div className="p-5 rounded-[1.5rem] bg-indigo-50/60 border-2 border-indigo-100 space-y-2">
                  <h3 className="font-black text-[#312E81] text-sm mb-3">ملخص الطلب</h3>
                  <div className="flex justify-between text-sm font-bold text-slate-600">
                    <span>نوع الاشتراك</span><span className="font-black">{clientType}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-600">
                    <span>من</span><span className="font-black text-left text-xs max-w-[55%] text-right">{homeLocation || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-600">
                    <span>إلى</span><span className="font-black text-left text-xs max-w-[55%] text-right">{workLocation || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-600">
                    <span>أيام العمل</span><span className="font-black">{selectedDays.length} أيام</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-600">
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
                className="px-6 py-4 rounded-[1.5rem] border-2 border-slate-200 font-black text-slate-500 hover:border-slate-300 transition-colors"
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
              className="flex-1 bg-[#312E81] text-white font-black py-4 rounded-[1.5rem] text-base shadow-xl shadow-indigo-900/20 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
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
