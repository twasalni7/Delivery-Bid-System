import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/time-utils";
import { ArrowRight, ArrowLeft, MapPin, Clock, CheckCircle, Phone, Users, Calendar, Plus, X, FileText, Bus } from "lucide-react";

const STEPS = [
  { id: 1, label: "العميل والمواقع", icon: MapPin },
  { id: 2, label: "الجدول والتفاصيل", icon: Clock },
  { id: 3, label: "المراجعة والإرسال", icon: CheckCircle },
];

const CLIENT_TYPES = ["موظفات", "طلاب", "مدارس", "جامعات", "معلمات", "غيره"];

type AdditionalLocation = { type: "pickup" | "dropoff"; address: string };

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();
  const [step, setStep] = useState(1);

  const [clientType, setClientType] = useState("غيره");
  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);
  const [phone, setPhone] = useState("");

  const [morningTime, setMorningTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState("5");
  const [numberOfShifts, setNumberOfShifts] = useState("1");
  const [notes, setNotes] = useState("");

  const canProceedStep1 = homeLocation.trim() && workLocation.trim() && phone.trim();
  const canProceedStep2 = morningTime && numberOfPeople && workingDaysPerWeek;

  const addLocation = () => {
    setAdditionalLocations((prev) => [...prev, { type: "pickup", address: "" }]);
  };

  const removeLocation = (idx: number) => {
    setAdditionalLocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLocation = (idx: number, field: "type" | "address", val: string) => {
    setAdditionalLocations((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l))
    );
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
          workingDaysPerWeek: parseInt(workingDaysPerWeek) || 5,
          numberOfShifts: parseInt(numberOfShifts) || 1,
          morningTime,
          eveningTime: eveningTime || undefined,
          notes: notes.trim() || undefined,
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
      <div className="max-w-lg mx-auto" dir="rtl">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للطلبات
        </Link>

        <h1 className="text-2xl font-black mb-6">طلب توصيل شهري جديد</h1>

        <div className="flex items-start mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle size={18} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-xs mt-1 font-medium text-center leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-5 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        <Card className="border-2">
          <CardContent className="pt-6">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-lg mb-1">نوع العميل والمواقع</h2>
                  <p className="text-muted-foreground text-sm">حدد نوعك ومواقع الرحلة</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-xs">نوع العميل</Label>
                  <div className="flex flex-wrap gap-2">
                    {CLIENT_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setClientType(t)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          clientType === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted border-border hover:border-primary"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="home" className="font-bold text-xs">موقع الانطلاق (الرئيسي)</Label>
                  <Input id="home" placeholder="مثال: حي النزهة، الرياض" value={homeLocation} onChange={(e) => setHomeLocation(e.target.value)} autoFocus />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="work" className="font-bold text-xs">الوجهة الرئيسية</Label>
                  <Input id="work" placeholder="مثال: طريق الملك فهد، برج أرامكو" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
                </div>

                {additionalLocations.map((loc, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <select
                          value={loc.type}
                          onChange={(e) => updateLocation(idx, "type", e.target.value)}
                          className="border rounded-md px-2 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="pickup">استلام</option>
                          <option value="dropoff">توصيل</option>
                        </select>
                        <Input
                          placeholder="العنوان..."
                          value={loc.address}
                          onChange={(e) => updateLocation(idx, "address", e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeLocation(idx)} className="mt-0.5 text-destructive hover:text-destructive">
                      <X size={15} />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addLocation} className="w-full gap-1 border-dashed">
                  <Plus size={14} /> إضافة موقع آخر
                </Button>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-bold text-xs">رقم الجوال للتواصل</Label>
                  <Input id="phone" type="tel" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
                  <p className="text-xs text-muted-foreground">يُخفى عن السائقين حتى يتم اختيار أحدهم</p>
                </div>
                <Button className="w-full font-bold" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  التالي <ArrowLeft size={16} className="mr-1" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-lg mb-1">الجدول والتفاصيل</h2>
                  <p className="text-muted-foreground text-sm">أوقات الذهاب والعودة وتفاصيل الرحلة</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">عدد الشفتات يومياً</Label>
                    <div className="flex gap-2">
                      {["1", "2"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setNumberOfShifts(v)}
                          className={`flex-1 py-2 rounded-md text-sm font-bold border transition-colors ${
                            numberOfShifts === v ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
                          }`}
                        >
                          {v === "1" ? "شفتة واحدة" : "شفتتان"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="days" className="font-bold text-xs">أيام العمل / أسبوع</Label>
                    <Input id="days" type="number" min="1" max="7" value={workingDaysPerWeek} onChange={(e) => setWorkingDaysPerWeek(e.target.value)} dir="ltr" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="morning" className="font-bold text-xs">وقت الذهاب (إلزامي)</Label>
                    <Input id="morning" type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} dir="ltr" />
                    {morningTime && <p className="text-xs text-muted-foreground">{formatTime12h(morningTime)}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="evening" className="font-bold text-xs">وقت العودة (اختياري)</Label>
                    <Input id="evening" type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} dir="ltr" />
                    {eveningTime && <p className="text-xs text-muted-foreground">{formatTime12h(eveningTime)}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="people" className="font-bold text-xs">عدد الأشخاص</Label>
                  <Input id="people" type="number" min="1" max="20" value={numberOfPeople} onChange={(e) => setNumberOfPeople(e.target.value)} dir="ltr" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="font-bold text-xs">ملاحظات للسائقين (اختياري)</Label>
                  <Textarea
                    id="notes"
                    placeholder="مثال: يفضل سائق لديه باص صغير، نساء فقط، إلخ..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowRight size={16} className="ml-1" /> السابق</Button>
                  <Button className="flex-1 font-bold" onClick={() => setStep(3)} disabled={!canProceedStep2}>
                    التالي <ArrowLeft size={16} className="mr-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-lg mb-1">مراجعة الطلب</h2>
                  <p className="text-muted-foreground text-sm">تأكد من صحة البيانات قبل الإرسال</p>
                </div>

                <div className="bg-muted/40 rounded-md border divide-y text-sm">
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Bus size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs text-muted-foreground mb-0.5">نوع العميل</p>
                      <p>{clientType}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 px-4 py-3">
                    <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-xs text-muted-foreground mb-0.5">المواقع</p>
                      <p>من: {homeLocation}</p>
                      <p>إلى: {workLocation}</p>
                      {additionalLocations.filter((l) => l.address.trim()).map((l, i) => (
                        <p key={i} className="text-muted-foreground">
                          {l.type === "pickup" ? "استلام" : "توصيل"}: {l.address}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Clock size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs text-muted-foreground mb-0.5">الأوقات</p>
                      <p>الذهاب: {formatTime12h(morningTime)}{eveningTime ? ` | العودة: ${formatTime12h(eveningTime)}` : ""}</p>
                      <p className="text-muted-foreground">{numberOfShifts === "1" ? "شفتة واحدة" : "شفتتان"} · {workingDaysPerWeek} أيام/أسبوع</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Users size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs text-muted-foreground mb-0.5">الأشخاص</p>
                      <p>{numberOfPeople} {parseInt(numberOfPeople) === 1 ? "شخص" : "أشخاص"}</p>
                    </div>
                  </div>
                  {notes.trim() && (
                    <div className="flex items-start gap-2 px-4 py-3">
                      <FileText size={15} className="text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs text-muted-foreground mb-0.5">ملاحظات</p>
                        <p>{notes}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Phone size={15} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs text-muted-foreground mb-0.5">رقم التواصل</p>
                      <p dir="ltr">{phone} <span className="text-muted-foreground text-xs">(مخفي حتى الاختيار)</span></p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowRight size={16} className="ml-1" /> السابق</Button>
                  <Button className="flex-1 font-bold" onClick={handleSubmit} disabled={createRequest.isPending}>
                    {createRequest.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
