import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRequests, useAdminUpdateRequest, useAdminDeleteRequest, getListRequestsQueryKey, UpdateStatusBodyStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, MapPin, Clock, Users } from "lucide-react";
import type { CommuteRequest } from "@workspace/api-client-react";
import { getStatusLabel, ALL_STATUSES } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

const STATUS_PILL: Record<string, string> = {
  OPEN:      "bg-blue-100 text-blue-700",
  BIDDING:   "bg-cyan-100 text-cyan-700",
  SELECTED:  "bg-amber-100 text-amber-700",
  ACTIVE:    "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-600",
  EXPIRED:   "bg-orange-100 text-orange-600",
  FROZEN:    "bg-slate-100 text-slate-600",
};

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: requests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 30_000 } });
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900">الطلبات</h1>
            <p className="text-gray-500 text-base mt-0.5">إدارة طلبات الدوام الشهري</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 rounded-xl border-gray-300 text-base font-bold h-11">
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

        {/* Stats bar */}
        {requests && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "الكل", count: requests.length, color: "bg-gray-100 text-gray-700" },
              { label: "مفتوح", count: requests.filter((r) => r.status === "OPEN").length, color: "bg-blue-100 text-blue-700" },
              { label: "تقديم عروض", count: requests.filter((r) => r.status === "BIDDING").length, color: "bg-cyan-100 text-cyan-700" },
              { label: "نشط", count: requests.filter((r) => r.status === "ACTIVE").length, color: "bg-green-100 text-green-700" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl px-4 py-3 text-center cursor-pointer ${s.color}`}
                onClick={() => setStatusFilter(s.label === "الكل" ? "ALL" : s.label === "مفتوح" ? "OPEN" : s.label === "تقديم عروض" ? "BIDDING" : "ACTIVE")}>
                <p className="text-2xl font-black">{s.count}</p>
                <p className="text-sm font-bold">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>}

        {!isLoading && (!filteredRequests || filteredRequests.length === 0) && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-xl font-bold text-gray-600">{statusFilter === "ALL" ? "لا توجد طلبات" : "لا توجد طلبات بهذه الحالة"}</p>
          </div>
        )}

        {filteredRequests && filteredRequests.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600 w-16">#</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الحالة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">المسار</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الوقت</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الأشخاص</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الأيام</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السائق المختار</th>
                    <th className="text-center px-5 py-4 text-sm font-black text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, idx) => (
                    <tr key={req.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-5 py-4 text-sm font-mono text-gray-400 font-bold">#{req.id}</td>
                      <td className="px-5 py-4">
                        <span className={`text-sm px-3 py-1 rounded-full font-bold ${STATUS_PILL[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {getStatusLabel(req.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <MapPin size={13} className="text-blue-500 shrink-0" />
                          <span className="font-medium">{req.homeLocation}</span>
                          <span className="text-gray-400">←</span>
                          <span className="font-medium">{req.workLocation}</span>
                        </div>
                        {req.phone && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">📞 {req.phone}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-700" dir="ltr">
                          <Clock size={13} className="text-gray-400" />
                          <span className="font-medium">{formatTime12h(req.morningTime)}</span>
                          {req.eveningTime && <><span className="text-gray-400">–</span><span className="font-medium">{formatTime12h(req.eveningTime)}</span></>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Users size={13} className="text-gray-400" />
                          <span className="font-bold">{req.numberOfPeople}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-600">{req.workingDaysPerWeek} أيام</td>
                      <td className="px-5 py-4">
                        {req.selectedDriver ? (
                          <span className="text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                            🚗 {req.selectedDriver.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(req)}
                            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:border-violet-400 hover:bg-violet-50 transition-colors">
                            <Edit2 size={14} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(req)}
                            className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center hover:border-red-400 transition-colors">
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-400">
                إجمالي: <strong className="text-gray-700">{filteredRequests.length}</strong> طلب
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-400 font-mono font-bold">#{req.id}</span>
                      <span className={`text-sm px-3 py-0.5 rounded-full font-bold ${STATUS_PILL[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {getStatusLabel(req.status)}
                      </span>
                      {req.selectedDriver && (
                        <span className="text-sm bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full font-bold">
                          🚗 {req.selectedDriver.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleEdit(req)}
                        className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:border-violet-400 transition-colors">
                        <Edit2 size={14} className="text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(req)}
                        className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center hover:border-red-400 transition-colors">
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <MapPin size={13} className="text-blue-500 shrink-0" />
                      <span className="font-medium">{req.homeLocation} ← {req.workLocation}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1" dir="ltr"><Clock size={13} /> {formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                      <span className="flex items-center gap-1"><Users size={13} /> {req.numberOfPeople} أشخاص</span>
                      <span className="font-medium">{req.workingDaysPerWeek} أيام/أسبوع</span>
                    </div>
                    {req.phone && <p className="text-sm text-gray-500" dir="ltr">📞 {req.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black">تعديل حالة الطلب #{editDialog?.id}</DialogTitle>
            </DialogHeader>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="rounded-xl h-12 text-base">
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
                className="flex-1 py-3 rounded-xl text-white font-black text-base disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                {updateRequest.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setEditDialog(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 text-base">
                إلغاء
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
