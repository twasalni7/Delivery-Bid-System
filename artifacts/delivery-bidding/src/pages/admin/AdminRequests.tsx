import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRequests, useAdminUpdateRequest, useAdminDeleteRequest, getListRequestsQueryKey, UpdateStatusBodyStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, MapPin, Clock, Users } from "lucide-react";
import type { CommuteRequest } from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح", SELECTED: "تم الاختيار", ACTIVE: "نشط", COMPLETED: "مكتمل", CANCELLED: "ملغى",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: requests, isLoading } = useListRequests();
  const updateRequest = useAdminUpdateRequest();
  const deleteRequest = useAdminDeleteRequest();

  const [editDialog, setEditDialog] = useState<CommuteRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });

  const handleEdit = (req: CommuteRequest) => {
    setEditStatus(req.status);
    setEditDialog(req);
  };

  const handleSave = () => {
    if (!editDialog) return;
    updateRequest.mutate(
      { id: editDialog.id, data: { status: editStatus as UpdateStatusBodyStatus } },
      {
        onSuccess: () => { refetch(); toast({ title: "تم التحديث!" }); setEditDialog(null); },
        onError: (err: Error) => toast({ title: err.message ?? "فشل التحديث", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (req: CommuteRequest) => {
    if (!confirm(`هل تريد حذف الطلب #${req.id}؟`)) return;
    deleteRequest.mutate(
      { id: req.id },
      {
        onSuccess: () => { refetch(); toast({ title: "تم الحذف!" }); },
        onError: (err: Error) => toast({ title: err.message ?? "فشل الحذف", variant: "destructive" }),
      }
    );
  };

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="mb-6">
          <h1 className="text-2xl font-black">الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة طلبات الدوام الشهري</p>
        </div>

        {isLoading && <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-20 border-2 border-dashed rounded-md">
            <p className="font-bold">لا توجد طلبات</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {requests?.map((req) => (
            <Card key={req.id} className="border-2">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs text-muted-foreground font-mono">#{req.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STATUS_COLORS[req.status] ?? ""}`}>
                        {STATUS_LABELS[req.status] ?? req.status}
                      </span>
                      {req.selectedDriver && (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                          السائق: {req.selectedDriver.name}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-primary shrink-0" />
                        <span className="truncate">{req.homeLocation} → {req.workLocation}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-primary shrink-0" />
                        <span dir="ltr">{req.morningTime} – {req.eveningTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-primary shrink-0" />
                        <span>{req.numberOfPeople} أشخاص • {req.workingDaysPerWeek} أيام/أسبوع</span>
                      </div>
                    </div>
                    {req.phone && (
                      <p className="text-xs text-muted-foreground mt-1" dir="ltr">📞 {req.phone}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(req)} title="تعديل الحالة">
                      <Edit2 size={13} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(req)} className="text-destructive border-destructive/30 hover:bg-destructive/5" title="حذف">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل حالة الطلب #{editDialog?.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <Button onClick={handleSave} disabled={updateRequest.isPending} className="font-bold">حفظ</Button>
              <Button variant="outline" onClick={() => setEditDialog(null)}>إلغاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
