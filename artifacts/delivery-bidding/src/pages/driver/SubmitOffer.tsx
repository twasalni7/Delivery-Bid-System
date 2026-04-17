import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequest,
  useCreateOffer,
  useGetDriver,
  getGetRequestQueryKey,
  getGetDriverQueryKey,
  getListRequestsQueryKey,
} from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Phone, AlertTriangle, Clock, Users, Calendar } from "lucide-react";

export default function SubmitOffer() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { driverId } = useDriverSession();

  useEffect(() => {
    if (!driverId) {
      setLocation("/driver");
    }
  }, [driverId, setLocation]);

  const { data: request, isLoading: loadingRequest } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  const { data: driver } = useGetDriver(driverId!, {
    query: { enabled: !!driverId, queryKey: getGetDriverQueryKey(driverId!) },
  });

  const createOffer = useCreateOffer();

  const [price, setPrice] = useState("");
  const [carType, setCarType] = useState("");
  const [nationality, setNationality] = useState("");

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || !carType.trim() || !nationality.trim()) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (!driverId) {
      toast({ title: "يرجى تسجيل الدخول أولاً", variant: "destructive" });
      return;
    }
    if (!hasEnoughBalance) {
      toast({ title: "رصيد غير كافٍ", description: "تحتاج إلى 50 ريال على الأقل لتقديم عرض", variant: "destructive" });
      return;
    }

    createOffer.mutate(
      {
        data: {
          driverId,
          requestId: reqId,
          price: parseFloat(price),
          carType: carType.trim(),
          nationality: nationality.trim(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey({ status: "OPEN" }) });
          toast({ title: "تم إرسال العرض!", description: "سيراجع العميل عرضك قريباً." });
          setLocation("/driver/dashboard");
        },
        onError: (error: { data?: { error?: string } }) => {
          toast({
            title: "فشل إرسال العرض",
            description: error?.data?.error || "حدث خطأ ما.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!driverId) return null;

  return (
    <Layout role="driver">
      <div className="max-w-xl mx-auto">
        <Link href="/driver/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للوحة السائق
        </Link>

        {loadingRequest && (
          <div className="text-center py-16 text-muted-foreground">جاري تحميل الطلب...</div>
        )}

        {request && (
          <>
            <Card className="border-2 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black flex items-center justify-between">
                  طلب دوام رقم #{request.id}
                  <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-sm font-bold">مفتوح</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">المنزل</p>
                      <p className="font-medium">{request.homeLocation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">العمل</p>
                      <p className="font-medium">{request.workLocation}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Users size={12} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">الأشخاص:</span>
                    <span className="font-bold text-xs">{request.numberOfPeople}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">الأيام:</span>
                    <span className="font-bold text-xs">{request.workingDaysPerWeek}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone size={12} className="text-muted-foreground" />
                    <span dir="ltr" className="text-xs">{request.phone}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-amber-500" />
                    <span className="text-xs text-muted-foreground">الذهاب:</span>
                    <span dir="ltr" className="font-bold text-xs">{request.morningTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-blue-500" />
                    <span className="text-xs text-muted-foreground">العودة:</span>
                    <span dir="ltr" className="font-bold text-xs">{request.eveningTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!hasEnoughBalance && driver && (
              <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-sm px-4 py-3 mb-6">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-red-800 text-sm">لا يمكن تقديم العرض</p>
                  <p className="text-red-700 text-xs mt-0.5">
                    رصيدك ({driver.balance.toFixed(2)} ر.س) أقل من الحد المطلوب (50 ر.س). تواصل مع الإدارة لشحن رصيدك.
                  </p>
                </div>
              </div>
            )}

            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black">تقديم عرضك</CardTitle>
                <CardDescription className="text-xs">
                  مسجّل دخول بـ <strong>{driver?.name}</strong> — الرصيد: {driver?.balance.toFixed(2) ?? "0.00"} ر.س
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="font-bold text-xs">سعرك الشهري (ر.س)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="مثال: 600.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="carType" className="font-bold text-xs">نوع السيارة</Label>
                    <Input
                      id="carType"
                      placeholder="مثال: تويوتا كامري، هايلكس، GMC"
                      value={carType}
                      onChange={(e) => setCarType(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nationality" className="font-bold text-xs">الجنسية</Label>
                    <Input
                      id="nationality"
                      placeholder="مثال: سعودي، مصري، باكستاني"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full font-bold"
                    disabled={createOffer.isPending || !hasEnoughBalance}
                  >
                    {createOffer.isPending ? "جاري الإرسال..." : "إرسال العرض"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
