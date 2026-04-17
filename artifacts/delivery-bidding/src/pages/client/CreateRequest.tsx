import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, MapPin, Clock, Users, CheckCircle } from "lucide-react";

const STEPS = [
  { id: 1, label: "المواقع", icon: MapPin },
  { id: 2, label: "الجدول", icon: Clock },
  { id: 3, label: "التفاصيل", icon: Users },
];

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();
  const [step, setStep] = useState(1);

  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [morningTime, setMorningTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState("5");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const canProceedStep1 = homeLocation.trim() && workLocation.trim();
  const canProceedStep2 = morningTime && eveningTime;
  const canProceedStep3 = phone.trim() && numberOfPeople && workingDaysPerWeek;

  const handleSubmit = () => {
    createRequest.mutate(
      {
        data: {
          homeLocation: homeLocation.trim(),
          workLocation: workLocation.trim(),
          phone: phone.trim(),
          numberOfPeople: parseInt(numberOfPeople) || 1,
          workingDaysPerWeek: parseInt(workingDaysPerWeek) || 5,
          morningTime,
          eveningTime,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: (req) => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم إضافة الطلب!", description: `طلب الدوام رقم #${req.id} مفتوح الآن.` });
          setLocation(`/client/request/${req.id}`);
        },
        onError: (err: any) => {
          toast({ title: (err as any)?.message ?? "فشل إضافة الطلب", variant: "destructive" });
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

        <h1 className="text-2xl font-black mb-6">طلب دوام شهري جديد</h1>

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
                  <span className={`text-xs mt-1 font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
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
                  <h2 className="font-bold text-lg mb-1">مواقع الرحلة</h2>
                  <p className="text-muted-foreground text-sm">أين تنطلق وأين وجهتك؟</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="home" className="font-bold text-xs">موقع المنزل</Label>
                  <Input id="home" placeholder="مثال: حي النزهة، الرياض" value={homeLocation} onChange={(e) => setHomeLocation(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="work" className="font-bold text-xs">موقع العمل</Label>
                  <Input id="work" placeholder="مثال: طريق الملك فهد، أرامكو" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
                </div>
                <Button className="w-full font-bold" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  التالي <ArrowLeft size={16} className="mr-1" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-lg mb-1">أوقات الدوام</h2>
                  <p className="text-muted-foreground text-sm">متى يبدأ الدوام وينتهي؟</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="morning" className="font-bold text-xs">وقت الذهاب (صباحاً)</Label>
                  <Input id="morning" type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evening" className="font-bold text-xs">وقت العودة (مساءً)</Label>
                  <Input id="evening" type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} dir="ltr" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowRight size={16} className="ml-1" /> السابق</Button>
                  <Button className="flex-1 font-bold" onClick={() => setStep(3)} disabled={!canProceedStep2}>التالي <ArrowLeft size={16} className="mr-1" /></Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-lg mb-1">التفاصيل</h2>
                  <p className="text-muted-foreground text-sm">معلومات إضافية للسائقين</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="people" className="font-bold text-xs">عدد الأشخاص</Label>
                    <Input id="people" type="number" min="1" max="10" value={numberOfPeople} onChange={(e) => setNumberOfPeople(e.target.value)} dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="days" className="font-bold text-xs">أيام العمل / أسبوع</Label>
                    <Input id="days" type="number" min="1" max="7" value={workingDaysPerWeek} onChange={(e) => setWorkingDaysPerWeek(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-bold text-xs">رقم الجوال للتواصل</Label>
                  <Input id="phone" type="tel" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
                  <p className="text-xs text-muted-foreground">يُخفى عن السائقين حتى يتم اختيار أحدهم</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="font-bold text-xs">ملاحظات (اختياري)</Label>
                  <Input id="notes" placeholder="أي تفاصيل إضافية..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowRight size={16} className="ml-1" /> السابق</Button>
                  <Button className="flex-1 font-bold" onClick={handleSubmit} disabled={!canProceedStep3 || createRequest.isPending}>
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
