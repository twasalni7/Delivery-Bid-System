import { Link } from "wouter";
import { useListRequests } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح",
  SELECTED: "تم الاختيار",
  ACTIVE: "نشط",
  COMPLETED: "مكتمل",
};

export default function ClientDashboard() {
  const { data: requests, isLoading } = useListRequests();

  return (
    <Layout role="client">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">طلبات الدوام الشهري</h1>
          <p className="text-muted-foreground mt-1 text-sm">استعرض جميع طلباتك وعروض السائقين</p>
        </div>
        <Button asChild className="font-bold">
          <Link href="/client/request/new">
            <PlusCircle className="ml-2 h-4 w-4" />
            طلب جديد
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="text-muted-foreground text-center py-16">جاري التحميل...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="text-xl font-bold">لا توجد طلبات بعد</p>
          <p className="text-muted-foreground mt-2 text-sm">أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
          <Button asChild className="mt-6 font-bold">
            <Link href="/client/request/new">إضافة طلب</Link>
          </Button>
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
                <TableHead className="font-bold text-xs">الأشخاص</TableHead>
                <TableHead className="font-bold text-xs">الأيام/أسبوع</TableHead>
                <TableHead className="font-bold text-xs">وقت الذهاب</TableHead>
                <TableHead className="font-bold text-xs">وقت العودة</TableHead>
                <TableHead className="font-bold text-xs">الحالة</TableHead>
                <TableHead className="font-bold text-xs">السائق</TableHead>
                <TableHead className="font-bold text-xs">العروض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell className="font-medium text-sm">{req.homeLocation}</TableCell>
                  <TableCell className="text-sm">{req.workLocation}</TableCell>
                  <TableCell className="text-center font-bold">{req.numberOfPeople}</TableCell>
                  <TableCell className="text-center">{req.workingDaysPerWeek} أيام</TableCell>
                  <TableCell className="text-sm">{req.morningTime}</TableCell>
                  <TableCell className="text-sm">{req.eveningTime}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${STATUS_COLORS[req.status] || ""}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.selectedDriver ? (
                      <span className="font-medium">{req.selectedDriver.name}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm" className="font-bold text-xs">
                      <Link href={`/client/request/${req.id}`}>عرض العروض</Link>
                    </Button>
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
