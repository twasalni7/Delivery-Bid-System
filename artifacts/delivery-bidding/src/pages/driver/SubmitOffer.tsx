import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useCreateOffer, getGetRequestQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Clock, Users } from "lucide-react";

export default function SubmitOffer() {
  const [, params] = useRoute("/driver/request/:id");
  const requestId = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: request, isLoading } = useGetRequest(requestId, { query: { queryKey: getGetRequestQueryKey(requestId), enabled: !!requestId } });
  const createOffer = useCreateOffer();

  const [price, setPrice] = useState("");
  const [carType, setCarType] = useState("");
  const [nationality, setNationality] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      toast({ title: "يرجى إدخال سعر صحيح", variant: "destructive" });
      return;
    }
    createOffer.mutate(
      { data: { requestId, price: numPrice, carType: carType.trim() || "—", nationality: nationality.trim() || "—" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
          toast({ title: "تم تقديم العرض بنجاح!" });
          setLocation("/driver/dashboard");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل تقديم العرض", variant: "destructive" });
        },
      }
    );
  };

  if (!user) {
    setLocation("/driver/login");
    return null;
  }

  if (isLoading) {
    return <Layout role="driver"><div className="text-center py-20 text-muted-foreground">جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="driver">
        <div className="text-center py-20">
          <p className="font-bold">الطلب غير موجود</p>
          <Button asChild className="mt-4"><Link href="/driver/dashboard">العودة</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="driver">
      <div className="max-w-lg mx-auto" dir="rtl">
        <Link href="/driver/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للوحة السائق
        </Link>

        <h1 className="text-2xl font-black mb-2">تقديم عرض</h1>
        <p className="text-muted-foreground text-sm mb-6">طلب #{request.id}</p>

        <Card className="border-2 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">تفاصيل الرحلة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={13} className="text-primary shrink-0" />
              <span>{request.homeLocation} → {request.workLocation}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={13} className="text-primary shrink-0" />
              <span dir="ltr">{request.morningTime} – {request.eveningTime}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users size={13} className="text-primary shrink-0" />
              <span>{request.numberOfPeople} أشخاص • {request.workingDaysPerWeek} أيام/أسبوع</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="font-bold text-xs">السعر الشهري (ريال)</Label>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="مثال: 850"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  dir="ltr"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carType" className="font-bold text-xs">نوع السيارة</Label>
                <Input
                  id="carType"
                  placeholder="مثال: تويوتا كامري 2022"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nationality" className="font-bold text-xs">الجنسية</Label>
                <Input
                  id="nationality"
                  placeholder="مثال: سعودي"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={createOffer.isPending}>
                {createOffer.isPending ? "جاري الإرسال..." : "تقديم العرض"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
