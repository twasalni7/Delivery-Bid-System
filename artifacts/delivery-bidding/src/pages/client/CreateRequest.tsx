import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [homeLocation, setHomeLocation] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("1");
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState("5");
  const [morningTime, setMorningTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeLocation.trim() || !workLocation.trim() || !phone.trim() || !morningTime || !eveningTime) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

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
        },
      },
      {
        onSuccess: (req) => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم إضافة الطلب!", description: `طلب الدوام رقم #${req.id} مفتوح الآن لعروض السائقين.` });
          setLocation(`/client/request/${req.id}`);
        },
        onError: () => {
          toast({ title: "فشل إضافة الطلب", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="client">
      <div className="max-w-xl mx-auto">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للطلبات
        </Link>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-black">طلب دوام شهري جديد</CardTitle>
            <CardDescription className="text-xs">أدخل تفاصيل رحلة الدوام وسيقوم السائقون بتقديم عروضهم</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="homeLocation" className="font-bold text-xs">موقع المنزل</Label>
                <Input
                  id="homeLocation"
                  placeholder="مثال: حي النزهة، الرياض"
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workLocation" className="font-bold text-xs">موقع العمل</Label>
                <Input
                  id="workLocation"
                  placeholder="مثال: طريق الملك فهد، برج المملكة"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="font-bold text-xs">رقم الهاتف</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="مثال: 0501234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="numberOfPeople" className="font-bold text-xs">عدد الأشخاص</Label>
                  <Input
                    id="numberOfPeople"
                    type="number"
                    min="1"
                    max="10"
                    value={numberOfPeople}
                    onChange={(e) => setNumberOfPeople(e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="workingDaysPerWeek" className="font-bold text-xs">أيام العمل بالأسبوع</Label>
                  <Input
                    id="workingDaysPerWeek"
                    type="number"
                    min="1"
                    max="7"
                    value={workingDaysPerWeek}
                    onChange={(e) => setWorkingDaysPerWeek(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="morningTime" className="font-bold text-xs">وقت الذهاب</Label>
                  <Input
                    id="morningTime"
                    type="time"
                    value={morningTime}
                    onChange={(e) => setMorningTime(e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eveningTime" className="font-bold text-xs">وقت العودة</Label>
                  <Input
                    id="eveningTime"
                    type="time"
                    value={eveningTime}
                    onChange={(e) => setEveningTime(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full font-bold"
                disabled={createRequest.isPending}
              >
                {createRequest.isPending ? "جاري الإرسال..." : "نشر طلب الدوام"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
