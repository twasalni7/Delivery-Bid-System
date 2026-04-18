import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRequests, useAdminUpdateRequest, useAdminDeleteRequest, getListRequestsQueryKey, UpdateStatusBodyStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2 } from "lucide-react";
import type { CommuteRequest } from "@workspace/api-client-react";
import { getStatusLabel, ALL_STATUSES } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

const STATUS_PILL: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  BIDDING: "bg-cyan-100 text-cyan-700",
  SELECTED: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
  EXPIRED: "bg-orange-100 text-orange-600",
  FROZEN: "bg-slate-100 text-slate-600",
};

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: requests, isLoading } = useListRequests();
  const updateRequest = useAdminUpdateRequest();
  const deleteRequest = useAdminDeleteRequest();
  const [editDialog, setEditDialog] = useState<CommuteRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });

  const filteredRequests = statusFilter === "ALL"
    ? requests
    : requests?.filter((r) => r.status === statusFilter);

  const handleEdit = (req: CommuteRequest) => { setEditStatus(req.status); setEditDialog(req); };

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900">الطلبات</h1>
            <p className="text-gray-400 text-sm">إدارة طلبات الدوام الشهري</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 rounded-xl border-gray-200">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل الحالات</SelectItem>
              {ALL_STATUSES.map((val) => (
                <SelectItem key={val} value={val}>{getStatusLabel(val)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {!isLoading && (!filteredRequests || filteredRequests.length === 0) && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-gray-500">{statusFilter === "ALL" ? "لا توجد طلبات" : "لا توجد طلبات بهذه الحالة"}</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredRequests?.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-300 font-mono">#{req.id}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${STATUS_PILL[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {getStatusLabel(req.status)}
                  </span>
                  {req.selectedDriver && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      🚗 {req.selectedDriver.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEdit(req)}
                    className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                    <Edit2 size={13} className="text-gray-500" />
                  </button>
                  <button onClick={() => handleDelete(req)}
                    className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center hover:border-red-400 transition-colors">
                    <Trash2 size={13} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs text-gray-500">
                <span>📍 {req.homeLocation} → {req.workLocation}</span>
                <span dir="ltr">⏰ {formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                <span>👥 {req.numberOfPeople} أشخاص • {req.workingDaysPerWeek} أيام/أسبوع</span>
                {req.phone && <span dir="ltr">📞 {req.phone}</span>}
              </div>
            </div>
          ))}
        </div>

        <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل حالة الطلب #{editDialog?.id}</DialogTitle>
            </DialogHeader>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((val) => (
                  <SelectItem key={val} value={val}>{getStatusLabel(val)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter className="gap-2 flex-row-reverse">
              <button onClick={handleSave} disabled={updateRequest.isPending}
                className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                {updateRequest.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setEditDialog(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600">
                إلغاء
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
