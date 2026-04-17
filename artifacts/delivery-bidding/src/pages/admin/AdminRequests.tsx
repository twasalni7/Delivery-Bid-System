import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRequests,
  useUpdateRequestStatus,
  getListRequestsQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Status = "OPEN" | "SELECTED" | "ACTIVE" | "COMPLETED";
const STATUSES: Status[] = ["OPEN", "SELECTED", "ACTIVE", "COMPLETED"];

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

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<Status | "ALL">("ALL");

  const params = filterStatus !== "ALL" ? { status: filterStatus } : undefined;
  const { data: requests, isLoading } = useListRequests(params);

  const updateStatus = useUpdateRequestStatus();

  const handleStatusChange = (requestId: number, status: Status) => {
    updateStatus.mutate(
      { id: requestId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          toast({ title: "تم تحديث الحالة", description: `الطلب #${requestId} → ${STATUS_LABELS[status]}` });
        },
        onError: () => {
          toast({ title: "فشل تحديث الحالة", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="admin">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black">جميع الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة وتحديث حالات طلبات الدوام</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">تصفية:</span>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "ALL")}>
            <SelectTrigger className="w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">الكل</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold">لا توجد طلبات</p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-xs">رقم</TableHead>
                <TableHead className="font-bold text-xs">المنزل</TableHead>
                <TableHead className="font-bold text-xs">العمل</TableHead>
                <TableHead className="font-bold text-xs">الهاتف</TableHead>
                <TableHead className="font-bold text-xs">الأشخاص</TableHead>
                <TableHead className="font-bold text-xs">الأيام</TableHead>
                <TableHead className="font-bold text-xs">الحالة</TableHead>
                <TableHead className="font-bold text-xs">السائق</TableHead>
                <TableHead className="font-bold text-xs">تغيير الحالة</TableHead>
                <TableHead className="font-bold text-xs">العروض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell className="font-medium text-sm">{req.homeLocation}</TableCell>
                  <TableCell className="text-sm">{req.workLocation}</TableCell>
                  <TableCell className="text-xs" dir="ltr">{req.phone}</TableCell>
                  <TableCell className="text-center font-bold">{req.numberOfPeople}</TableCell>
                  <TableCell className="text-center">{req.workingDaysPerWeek}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${STATUS_COLORS[req.status] || ""}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.selectedDriver?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={req.status}
                      onValueChange={(v) => handleStatusChange(req.id, v as Status)}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost" className="text-xs font-bold">
                      <Link href={`/client/request/${req.id}`}>عرض</Link>
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
