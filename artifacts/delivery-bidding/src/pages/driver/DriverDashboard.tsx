import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Banknote, MapPin, Clock, Users, ChevronLeft, CheckCircle, Phone } from "lucide-react";

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  const { data: openRequests, isLoading } = useListRequests({ status: "OPEN" });
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" });

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  if (!user) return null;

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;
  const mySelectedJobs = selectedRequests?.filter((r) => r.selectedDriverId === user.id) ?? [];

  return (
    <Layout role="driver">
      <div dir="rtl">
        <div className="mb-6">
          <h1 className="text-2xl font-black">لوحة السائق</h1>
          <p className="text-muted-foreground text-sm mt-0.5">طلبات الدوام المفتوحة — قدّم أفضل عرضك</p>
        </div>

        {driver && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card className="border-2">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">اسم السائق</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-black">{driver.name}</p>
              </CardContent>
            </Card>

            <Card className={`border-2 ${hasEnoughBalance ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}`}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Banknote size={12} /> الرصيد
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-lg font-black ${hasEnoughBalance ? "text-green-700" : "text-red-600"}`} dir="ltr">
                  {driver.balance.toFixed(2)} ر.س
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 col-span-2 sm:col-span-1">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">طلبات مفتوحة</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-black">{openRequests?.length ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {mySelectedJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-black mb-3 text-green-700">🎉 تم اختيارك!</h2>
            <div className="space-y-3">
              {mySelectedJobs.map((req) => (
                <div key={req.id} className="flex items-start gap-3 bg-green-50 border-2 border-green-300 rounded-md px-4 py-4">
                  <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-800 text-sm mb-1">تم اختيارك لطلب #{req.id}</p>
                    <div className="flex items-center gap-1.5 text-green-700 text-xs mb-1">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{req.homeLocation} → {req.workLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-700 text-xs" dir="ltr">
                      <Clock size={11} className="shrink-0" />
                      <span>{req.morningTime} – {req.eveningTime}</span>
                    </div>
                    {req.phone && (
                      <div className="flex items-center gap-1.5 text-green-800 text-sm font-bold mt-2">
                        <Phone size={13} className="shrink-0" />
                        <span dir="ltr">{req.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-md px-4 py-3 mb-6">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-700 text-xs mt-0.5">
                تحتاج إلى رصيد بحد أدنى 50 ريال لتقديم عروض. رصيدك الحالي: {driver.balance.toFixed(2)} ر.س. تواصل مع الإدارة لشحن الرصيد.
              </p>
            </div>
          </div>
        )}

        <h2 className="text-base font-black mb-3">الطلبات المتاحة</h2>

        {isLoading && <div className="text-center py-16 text-muted-foreground">جاري تحميل الطلبات...</div>}

        {!isLoading && (!openRequests || openRequests.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed rounded-md">
            <p className="text-xl font-bold">لا توجد طلبات مفتوحة</p>
            <p className="text-muted-foreground text-sm mt-2">تحقق لاحقاً لعروض دوام جديدة</p>
          </div>
        )}

        {openRequests && openRequests.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {openRequests.map((req) => (
              <Card key={req.id} className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-mono mb-2">طلب #{req.id}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin size={13} className="shrink-0 text-primary" />
                          <span className="truncate">{req.homeLocation} → {req.workLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock size={13} className="shrink-0 text-primary" />
                          <span dir="ltr">{req.morningTime} – {req.eveningTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users size={13} className="shrink-0 text-primary" />
                          <span>{req.numberOfPeople} أشخاص • {req.workingDaysPerWeek} أيام</span>
                        </div>
                      </div>
                    </div>
                    {hasEnoughBalance && (
                      <Button asChild size="sm" className="font-bold shrink-0 gap-1">
                        <Link href={`/driver/request/${req.id}`}>
                          عرض <ChevronLeft size={14} />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
