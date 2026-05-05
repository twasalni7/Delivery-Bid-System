import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useListRequests, useAdminUpdateRequest, useAdminDeleteRequest, getListRequestsQueryKey, UpdateStatusBodyStatus } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Trash2, Edit2, MapPin, Clock, Users, Search, X, Plus, Eye } from "lucide-react";
import type { CommuteRequest } from "@workspace/api-client-react";
import { getStatusLabel, ALL_STATUSES } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

const STATUS_PILL_STYLE: Record<string, React.CSSProperties> = {
  OPEN:      { backgroundColor: "var(--status-open-bg)",      color: "var(--status-open-text)" },
  SELECTED:  { backgroundColor: "var(--status-selected-bg)",  color: "var(--status-selected-text)" },
  ACTIVE:    { backgroundColor: "var(--status-active-bg)",    color: "var(--status-active-text)" },
  COMPLETED: { backgroundColor: "var(--status-completed-bg)", color: "var(--status-completed-text)" },
  CANCELLED: { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" },
  EXPIRED:   { backgroundColor: "var(--status-expired-bg)",   color: "var(--status-expired-text)" },
  FROZEN:    { backgroundColor: "var(--status-frozen-bg)",    color: "var(--status-frozen-text)" },
};


export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 15_000 } as any });
  const updateRequest = useAdminUpdateRequest();
  const deleteRequest = useAdminDeleteRequest();
  const [editDialog, setEditDialog] = useState<CommuteRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");

  // Real-time: refresh when any request is created or its status changes
  useRealtimeRefresh(
    "admin-requests-realtime",
    [{ table: "requests", events: ["INSERT", "UPDATE"] }],
    [getListRequestsQueryKey()]
  );

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q) {
        const hay = [
          r.homeLocation, r.workLocation, r.phone ?? "",
          r.selectedDriver?.name ?? "", String(r.id),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (search ? 1 : 0);

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

  const resetFilters = () => { setStatusFilter("ALL"); setSearch(""); };

  return (
    <Layout role="admin">
      <div dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
          <div className="flex-1">
            <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>الطلبات</h1>
            <p className="text-base mt-0.5 font-bold" style={{ color: "var(--text-muted)" }}>
              {requests ? `${filteredRequests.length} من ${requests.length} طلب` : "إدارة طلبات الدوام الشهري"}
            </p>
          </div>
          <Link href="/admin/requests/new">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm active:scale-95 transition-transform"
              style={{ backgroundColor: "var(--brand)" }}
            >
              <Plus size={16} /> إضافة طلب جديد
            </button>
          </Link>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3 mb-5">
          {/* Search bar */}
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-colors" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <Search size={17} className="shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="ابحث بالموقع، الجوال، السائق، رقم الطلب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-base bg-transparent outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ color: "var(--text-muted)" }}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-xl text-sm font-bold w-36" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", color: "var(--text-sub)" }}>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">كل الحالات</SelectItem>
                {ALL_STATUSES.map((val) => (
                  <SelectItem key={val} value={val}>{getStatusLabel(val)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeFilters > 0 && (
              <button onClick={resetFilters}
                className="h-9 px-3.5 rounded-xl text-sm font-bold flex items-center gap-1.5"
                style={{ color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)", backgroundColor: "var(--status-cancelled-bg)" }}>
                <X size={13} /> مسح الفلاتر ({activeFilters})
              </button>
            )}

            {/* Quick status tabs */}
            <div className="flex gap-1 mr-auto flex-wrap">
              {[
                { label: "الكل", val: "ALL", count: requests?.length ?? 0 },
                { label: "مفتوح", val: "OPEN", count: requests?.filter((r) => r.status === "OPEN").length ?? 0 },
                { label: "نشط", val: "ACTIVE", count: requests?.filter((r) => r.status === "ACTIVE").length ?? 0 },
              ].map((s) => (
                <button key={s.val} onClick={() => setStatusFilter(s.val)}
                  className="h-9 px-3 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"
                  style={statusFilter === s.val
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                    : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                  {s.label}
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-black" style={statusFilter === s.val ? { backgroundColor: "rgba(0,0,0,0.2)" } : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && <div className="text-center py-20 text-lg font-bold" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>}

        {!isLoading && filteredRequests.length === 0 && (
          <div className="text-center py-24 rounded-2xl" style={{ border: "2px dashed var(--border-subtle)" }}>
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-muted)" }}>
              {activeFilters > 0 || search ? "لا توجد نتائج مطابقة" : "لا توجد طلبات"}
            </p>
            {(activeFilters > 0 || search) && (
              <button onClick={resetFilters} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ color: "var(--brand)", border: "1px solid var(--brand-border)" }}>مسح الفلاتر</button>
            )}
          </div>
        )}

        {filteredRequests.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <table className="w-full" dir="rtl">
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th className="text-right px-5 py-4 text-sm font-black w-16" style={{ color: "var(--text-muted)" }}>#</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>الحالة</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>النوع</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>المسار</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>الوقت</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>أشخاص / أيام</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>السائق المختار</th>
                    <th className="text-center px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, idx) => (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: idx % 2 === 1 ? "var(--border-subtle)" : "transparent" }}>
                      <td className="px-5 py-4 text-sm font-mono font-bold" style={{ color: "var(--text-muted)" }}>
                         #{req.id}
                         {req.createdBy === "admin" && (
                           <span className="mr-1.5 text-xs px-1.5 py-0.5 rounded-full font-black align-middle" style={{ backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)" }}>إداري</span>
                         )}
                       </td>
                      <td className="px-5 py-4">
                        <span className="text-sm px-3 py-1 rounded-full font-bold" style={STATUS_PILL_STYLE[req.status] ?? { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                          {getStatusLabel(req.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ color: "var(--text-sub)", backgroundColor: "var(--border-subtle)" }}>{(req as any).clientType ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin size={13} style={{ color: "var(--brand)" }} className="shrink-0" />
                          <span className="font-medium">{req.homeLocation}</span>
                          <span style={{ color: "var(--text-hint)" }}>←</span>
                          <span className="font-medium">{req.workLocation}</span>
                        </div>
                        {(req as any).additionalLocations?.map((loc: { type: string; address: string }, i: number) => (
                          <p key={i} className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>📍 {loc.type === "pickup" ? "استلام" : "توصيل"}: {loc.address}</p>
                        ))}
                        {req.phone && <p className="text-xs mt-0.5" dir="ltr" style={{ color: "var(--text-hint)" }}>📞 {req.phone}</p>}
                        {(req as any).notes && <p className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>📝 {(req as any).notes}</p>}
                      </td>
                      <td className="px-5 py-4">
                        {(req as any).shifts && (req as any).shifts.length > 0 ? (
                          <div className="space-y-0.5">
                            {((req as any).shifts as Array<{ label?: string; goTime: string; returnTime?: string }>).map((s, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs" dir="ltr">
                                <Clock size={11} style={{ color: "var(--text-hint)" }} />
                                <span className="font-medium">{formatTime12h(s.goTime)}{s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}</span>
                                {s.label && <span style={{ color: "var(--text-hint)" }}>({s.label})</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm" dir="ltr">
                            <Clock size={13} style={{ color: "var(--text-hint)" }} />
                            <span className="font-medium">{formatTime12h(req.morningTime)}</span>
                            {req.eveningTime && <><span style={{ color: "var(--text-hint)" }}>–</span><span className="font-medium">{formatTime12h(req.eveningTime)}</span></>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Users size={13} style={{ color: "var(--text-hint)" }} />
                          <span className="font-bold">{req.numberOfPeople}</span>
                          <span style={{ color: "var(--text-hint)" }}>·</span>
                          <span>{req.workingDaysPerWeek} أيام</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {req.selectedDriver ? (
                          <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--brand-border)", color: "var(--brand)" }}>🚗 {req.selectedDriver.name}</span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-hint)" }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/admin/request/${req.id}`}>
                            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                              <Eye size={14} style={{ color: "var(--brand)" }} />
                            </button>
                          </Link>
                          <button onClick={() => handleEdit(req)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                            <Edit2 size={14} style={{ color: "var(--text-muted)" }} />
                          </button>
                          <button onClick={() => handleDelete(req)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
                            <Trash2 size={14} style={{ color: "var(--status-cancelled-text)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 text-sm" style={{ backgroundColor: "var(--surface-2)", borderTop: "1px solid var(--border-subtle)", color: "var(--text-hint)" }}>
                يُعرض <strong style={{ color: "var(--text)" }}>{filteredRequests.length}</strong> من <strong style={{ color: "var(--text)" }}>{requests?.length ?? 0}</strong> طلب
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold" style={{ color: "var(--text-muted)" }}>#{req.id}</span>
                       {req.createdBy === "admin" && (
                         <span className="text-xs px-1.5 py-0.5 rounded-full font-black" style={{ backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)" }}>إداري</span>
                       )}
                      <span className="text-sm px-3 py-0.5 rounded-full font-bold" style={STATUS_PILL_STYLE[req.status] ?? { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                        {getStatusLabel(req.status)}
                      </span>
                      {req.selectedDriver && <span className="text-sm px-2.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--brand-border)", color: "var(--brand)" }}>🚗 {req.selectedDriver.name}</span>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/admin/request/${req.id}`}>
                        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}><Eye size={14} style={{ color: "var(--brand)" }} /></button>
                      </Link>
                      <button onClick={() => handleEdit(req)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}><Edit2 size={14} style={{ color: "var(--text-muted)" }} /></button>
                      <button onClick={() => handleDelete(req)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}><Trash2 size={14} style={{ color: "var(--status-cancelled-text)" }} /></button>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin size={13} style={{ color: "var(--brand)" }} className="shrink-0" />
                      <span className="font-medium">{req.homeLocation} ← {req.workLocation}</span>
                    </div>
                    {(req as any).additionalLocations?.map((loc: { type: string; address: string }, i: number) => (
                      <p key={i} className="text-xs" style={{ color: "var(--text-hint)" }}>📍 {loc.type === "pickup" ? "استلام" : "توصيل"}: {loc.address}</p>
                    ))}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {(req as any).shifts && (req as any).shifts.length > 0 ? (
                        <span className="flex items-center gap-1 flex-wrap" dir="ltr">
                          <Clock size={13} />
                          {((req as any).shifts as Array<{ label?: string; goTime: string; returnTime?: string }>).map((s, i) => (
                            <span key={i}>{formatTime12h(s.goTime)}{s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}{i < (req as any).shifts.length - 1 ? " |" : ""}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" dir="ltr"><Clock size={13} /> {formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                      )}
                      <span className="flex items-center gap-1"><Users size={13} /> {req.numberOfPeople} · {req.workingDaysPerWeek} أيام</span>
                    </div>
                    {req.phone && <p className="text-sm" dir="ltr" style={{ color: "var(--text-muted)" }}>📞 {req.phone}</p>}
                    {(req as any).notes && <p className="text-xs" style={{ color: "var(--text-hint)" }}>📝 {(req as any).notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black" style={{ color: "var(--text)" }}>تعديل حالة الطلب #{editDialog?.id}</DialogTitle>
            </DialogHeader>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="rounded-xl h-12 text-base"><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((val) => <SelectItem key={val} value={val}>{getStatusLabel(val)}</SelectItem>)}
              </SelectContent>
            </Select>
            <DialogFooter className="gap-2 flex-row-reverse">
              <button onClick={handleSave} disabled={updateRequest.isPending}
                className="flex-1 py-3 rounded-xl font-black text-base disabled:opacity-50"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
                {updateRequest.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setEditDialog(null)} className="flex-1 py-3 rounded-xl font-bold text-base" style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>إلغاء</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
