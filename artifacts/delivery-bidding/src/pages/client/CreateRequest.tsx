import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/time-utils";
import { ArrowRight, Plus, X } from "lucide-react";

const CLIENT_TYPES = [
  { value: "طلاب",    emoji: "🎓", label: "طلاب" },
  { value: "موظفات", emoji: "👩‍💼", label: "موظفات" },
  { value: "مدارس",  emoji: "🏫", label: "مدارس" },
  { value: "جامعات", emoji: "🎓", label: "جامعات" },
  { value: "معلمات", emoji: "📚", label: "معلمات" },
  { value: "غيره",   emoji: "📦", label: "غيره" },
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

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [clientType, setClientType] = useState("موظفات");
  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const [morningTime, setMorningTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [selectedDays, setSelectedDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);
  const [notes, setNotes] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");

  const toggleDay = (key: string) => {
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  };

  const addLocation = () => setAdditionalLocations((prev) => [...prev, { type: "pickup", address: "" }]);
  const removeLocation = (idx: number) => setAdditionalLocations((prev) => prev.filter((_, i) => i !== idx));
  const updateLocation = (idx: number, field: "type" | "address", val: string) => {
    setAdditionalLocations((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  };

  const canSubmit = homeLocation.trim() && workLocation.trim() && phone.trim() && morningTime && selectedDays.length > 0 && monthlyPrice.trim() && parseFloat(monthlyPrice) > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
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
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-5">
          <ArrowRight size={14} /> العودة
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">اشتراك شهري جديد</h1>
          <p className="text-gray-400 text-sm mt-0.5">أدخل تفاصيل رحلتك اليومية</p>
        </div>

        <div className="space-y-5">
          <Section number={1} title="نوع الاشتراك">
            <div className="grid grid-cols-3 gap-2">
              {CLIENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setClientType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    clientType === t.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className={`text-xs font-bold ${clientType === t.value ? "text-blue-600" : "text-gray-600"}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section number={2} title="المواقع">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">📍 موقع الانطلاق (الرئيسي)</label>
                <Input
                  placeholder="مثال: حي النزهة، الرياض"
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-blue-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">📍 موقع الوصول (العمل/المدرسة)</label>
                <Input
                  placeholder="مثال: طريق الملك فهد، برج القيطلية"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-blue-400"
                />
              </div>

              {additionalLocations.map((loc, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-2">
                      <select
                        value={loc.type}
                        onChange={(e) => updateLocation(idx, "type", e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                      >
                        <option value="pickup">استلام</option>
                        <option value="dropoff">توصيل</option>
                      </select>
                      <Input
                        placeholder="العنوان..."
                        value={loc.address}
                        onChange={(e) => updateLocation(idx, "address", e.target.value)}
                        className="flex-1 rounded-xl border-gray-200"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeLocation(idx)} className="mt-2 p-1.5 text-red-400 hover:text-red-600">
                    <X size={15} />
                  </button>
                </div>
              ))}

              <button onClick={addLocation} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Plus size={14} /> إضافة موقع آخر
              </button>
            </div>
          </Section>

          <Section number={3} title="الجدول الزمني">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">⏰ وقت الذهاب</label>
                  <Input
                    type="time"
                    value={morningTime}
                    onChange={(e) => setMorningTime(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-blue-400"
                    dir="ltr"
                  />
                  {morningTime && <p className="text-xs text-gray-400 mt-1">{formatTime12h(morningTime)}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">⏰ وقت العودة</label>
                  <Input
                    type="time"
                    value={eveningTime}
                    onChange={(e) => setEveningTime(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-blue-400"
                    dir="ltr"
                  />
                  {eveningTime && <p className="text-xs text-gray-400 mt-1">{formatTime12h(eveningTime)}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">أيام العمل</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => toggleDay(d.key)}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                        selectedDays.includes(d.key)
                          ? "text-white shadow-sm"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                      style={selectedDays.includes(d.key) ? { background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" } : {}}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{selectedDays.length} أيام في الأسبوع</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">👥 عدد الأشخاص</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setNumberOfPeople((p) => String(Math.max(1, parseInt(p) - 1)))}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200">−</button>
                  <span className="text-2xl font-black text-gray-800 w-8 text-center">{numberOfPeople}</span>
                  <button onClick={() => setNumberOfPeople((p) => String(Math.min(20, parseInt(p) + 1)))}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200">+</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">ملاحظات للسائقين (اختياري)</label>
                <Textarea
                  placeholder="مثال: يفضل سائق لديه باص، نساء فقط..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-xl border-gray-200 focus:border-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">💰 السعر الشهري (ريال) *</label>
                <div className="relative">
                  <Input
                    type="number" min="1" step="1"
                    placeholder="مثال: 800"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-blue-400 text-lg font-black pl-14"
                    dir="ltr"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">ر.س</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">هذا السعر الذي ستدفعه شهرياً للسائق</p>
              </div>
            </div>
          </Section>

          <Section number={4} title="بيانات التواصل">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاسم الكامل (اختياري)</label>
                <Input
                  placeholder="مثال: سارة أحمد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الجوال *</label>
                <Input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-blue-400"
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">يُخفى عن السائقين حتى يتم اختيار أحدهم</p>
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createRequest.isPending}
            className="w-full py-4 rounded-2xl text-white font-black text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:scale-100"
            style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}
          >
            {createRequest.isPending ? "جاري الإرسال..." : "نشر الطلب للسائقين"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
          style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}>
          {number}
        </div>
        <h2 className="font-black text-gray-800">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
