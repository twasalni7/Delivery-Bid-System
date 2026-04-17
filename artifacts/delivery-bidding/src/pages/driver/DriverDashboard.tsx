import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useListRequests, useGetDriver, getGetDriverQueryKey } from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Banknote, MapPin, Calendar, Clock, Users, ArrowLeft } from "lucide-react";

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { driverId } = useDriverSession();

  useEffect(() => {
    if (!driverId) {
      setLocation("/driver");
    }
  }, [driverId, setLocation]);

  const { data: driver } = useGetDriver(driverId!, {
    query: { enabled: !!driverId, queryKey: getGetDriverQueryKey(driverId!) },
  });

  const { data: requests, isLoading } = useListRequests({ status: "OPEN" });

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;

  if (!driverId) return null;

  return (
    <Layout role="driver">
      <div className="mb-8">
        <h1 className="text-3xl font-black">لوحة السائق</h1>
        <p className="text-muted-foreground text-sm mt-1">طلبات الدوام المفتوحة — قدّم أفضل عرضك</p>
      </div>

      {driver && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-2">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">السائق</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-black">{driver.name}</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${hasEnoughBalance ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Banknote size={12} /> الرصيد
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-2xl font-black ${hasEnoughBalance ? "text-green-700" : "text-red-600"}`} dir="ltr">
                {driver.balance.toFixed(2)} ر.س
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">طلبات مفتوحة</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-black">{requests?.length ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasEnoughBalance && driver && (
        <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-sm px-4 py-3 mb-6">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">رصيد غير كافٍ</p>
            <p className="text-amber-700 text-xs mt-0.5">
              تحتاج إلى رصيد بحد أدنى 50 ريال لتقديم عروض. رصيدك الحالي: {driver.balance.toFixed(2)} ر.س. تواصل مع الإدارة لشحن الرصيد.
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">جاري تحميل الطلبات...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="text-xl font-bold">لا توجد طلبات مفتوحة</p>
          <p className="text-muted-foreground text-sm mt-2">تحقق لاحقاً لعروض دوام جديدة</p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-xs">رقم</TableHead>
                <TableHead className="font-bold text-xs">موقع المنزل</TableHead>
                <TableHead className="font-bold text-xs">موقع العمل</TableHead>
                <TableHead className="font-bold text-xs">أشخاص</TableHead>
                <TableHead className="font-bold text-xs">أيام</TableHead>
                <TableHead className="font-bold text-xs">وقت الذهاب</TableHead>
                <TableHead className="font-bold text-xs">وقت العودة</TableHead>
                <TableHead className="font-bold text-xs">تقديم عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{req.homeLocation}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-primary shrink-0" />
                      <span className="text-sm">{req.workLocation}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users size={12} className="text-muted-foreground" />
                      <span className="font-bold">{req.numberOfPeople}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      <span>{req.workingDaysPerWeek}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-amber-500" />
                      <span dir="ltr" className="text-sm">{req.morningTime}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-blue-500" />
                      <span dir="ltr" className="text-sm">{req.eveningTime}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {hasEnoughBalance ? (
                      <Button asChild size="sm" className="font-bold text-xs">
                        <Link href={`/driver/request/${req.id}`}>
                          تقديم عرض <ArrowLeft size={12} className="mr-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="font-bold text-xs text-muted-foreground">
                        تقديم عرض
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Layout>
  );
}
