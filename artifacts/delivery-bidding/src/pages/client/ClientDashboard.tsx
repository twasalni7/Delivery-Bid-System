import { Link } from "wouter";
import { useListRequests } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MapPin, Clock, Users, ChevronLeft } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح",
  SELECTED: "تم الاختيار",
  ACTIVE: "نشط",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

export default function ClientDashboard() {
  const { data: requests, isLoading } = useListRequests();

  return (
    <Layout role="client">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">طلباتي</h1>
            <p className="text-muted-foreground text-sm mt-0.5">طلبات الدوام الشهري الخاصة بك</p>
          </div>
          <Button asChild className="font-bold">
            <Link href="/client/request/new">
              <PlusCircle size={16} className="ml-1" />
              طلب جديد
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-20 border-2 border-dashed rounded-md">
            <p className="text-xl font-bold">لا توجد طلبات بعد</p>
            <p className="text-muted-foreground mt-2 text-sm">أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
            <Button asChild className="mt-6 font-bold">
              <Link href="/client/request/new">إضافة طلب</Link>
            </Button>
          </div>
        )}

        {requests && requests.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {requests.map((req) => (
              <Card key={req.id} className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs text-muted-foreground font-mono">#{req.id}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${STATUS_COLORS[req.status] || ""}`}>
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                        {req.selectedDriver && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-medium">
                            السائق: {req.selectedDriver.name}
                          </span>
                        )}
                      </div>
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
                          <span>{req.numberOfPeople} {req.numberOfPeople === 1 ? "شخص" : "أشخاص"} • {req.workingDaysPerWeek} أيام/أسبوع</span>
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0 font-bold text-xs gap-1">
                      <Link href={`/client/request/${req.id}`}>
                        العروض
                        <ChevronLeft size={14} />
                      </Link>
                    </Button>
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
