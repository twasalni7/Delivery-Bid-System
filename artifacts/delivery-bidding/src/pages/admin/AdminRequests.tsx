import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useListRequests, useAdminDeleteRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Trash2, MapPin, Clock, Users, Search, X, Plus, Eye } from "lucide-react";
import type { CommuteRequest } from "@workspace/api-client-react";
import { getStatusLabel, ALL_STATUSES } from "@/lib/status-utils";
import { formatTime12h, formatTime12hLong } from "@/lib/time-utils";

const STATUS_PILL_STYLE: Record<string, React.CSSProperties> = {
  OPEN:      { backgroundColor: "var(--status-open-bg)",      color: "var(--status-open-text)" },
  SELECTED:  { backgroundColor: "var(--status-selected-bg)",  color: "var(--status-selected-text)" },
  ACTIVE:    { backgroundColor: "var(--status-active-bg)",    color: "var(--status-active-text)" },
  COMPLETED: { backgroundColor: "var(--status-completed-bg)", color: "var(--status-completed-text)" },
  CANCELLED: { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" },
  EXPIRED:   { backgroundColor: "var(--status-expired-bg)",   color: "var(--status-expired-text)" },
  FROZEN:    { backgroundColor: "var(--status-frozen-bg)",    color: "var(--status-frozen-text)" },
};

// Admin list responses can include client summary fields that are not part of the base request schema.
type AdminRequest = CommuteRequest & {
  client?: { name?: string | null; mobile?: string | null } | null;
};


export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 15_000 } as any });
  const deleteRequest = useAdminDeleteRequest();

  // Real-time: refresh when any request is created or its status changes
  useRealtimeRefresh(
    "admin-requests-realtime",
    [{ table: "requests", events: ["INSERT", "UPDATE"] }],
    [getListRequestsQueryKey()]
  );

  const refetch = () => queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });

  const filteredRequests = useMemo<AdminRequest[]>(() => {
    const q = search.trim().toLowerCase();
    return ((requests ?? []) as AdminRequest[]).filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q) {
        const hay = [
          r.homeLocation, r.workLocation, r.phone ?? "",
          r.selectedDriver?.name ?? "", r.client?.name ?? "", r.client?.mobile ?? "", String(r.id),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>([["ALL", requests?.length ?? 0]]);
    for (const req of requests ?? []) counts.set(req.status, (counts.get(req.status) ?? 0) + 1);
    return counts;
  }, [requests]);

  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (search ? 1 : 0);

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

          {/* Unified status filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {(["ALL", ...ALL_STATUSES] as const).map((val) => {
              const active = statusFilter === val;
              return (
                <button key={val} onClick={() => setStatusFilter(val)}
                  className="h-9 px-3 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"
                  style={active
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                    : { backgroundColor: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                  {val === "ALL" ? "الكل" : getStatusLabel(val)}
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-black" style={active ? { backgroundColor: "rgba(0,0,0,0.2)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {statusCounts.get(val) ?? 0}
                  </span>
                </button>
              );
            })}

            {activeFilters > 0 && (
              <button onClick={resetFilters}
                className="h-9 px-3.5 rounded-xl text-sm font-bold flex items-center gap-1.5"
                style={{ color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)", backgroundColor: "var(--status-cancelled-bg)" }}>
                <X size={13} /> مسح الفلاتر ({activeFilters})
              </button>
            )}
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
            <div
              className="hidden md:block rounded-3xl overflow-hidden"
              style={{
                backgroundColor: "var(--surface)",
                border: "2px solid var(--border)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <table className="w-full" dir="rtl">
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--surface-3)",
                      borderBottom: "2px solid var(--border)",
                    }}
                  >
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
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: "1.5px solid var(--border)",
                        backgroundColor: idx % 2 === 1 ? "var(--surface-2)" : "transparent",
                      }}
                    >
                      <td className="px-5 py-4 text-sm font-mono font-bold" style={{ color: "var(--text-muted)" }}>
                         #{req.id}
                         {req.createdBy === "admin" && (
                           <span className="mr-1.5 text-xs px-1.5 py-0.5 rounded-full font-black align-middle" style={{ backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)" }}>إداري</span>
                         )}
                       </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm px-3.5 py-1.5 rounded-2xl font-bold"
                            style={STATUS_PILL_STYLE[req.status] ?? {
                              backgroundColor: "var(--surface-2)",
                              color: "var(--text-muted)",
                              border: "1.5px solid var(--border)",
                            }}
                          >
                            {getStatusLabel(req.status)}
                          </span>
                          {req.statusManuallySetByAdmin && (
                            <span
                              title="الحالة مثبّتة يدوياً — التزامن التلقائي متوقف"
                              className="text-xs px-2 py-1 rounded-full font-black"
                              style={{
                                backgroundColor: "var(--status-frozen-bg)",
                                color: "var(--status-frozen-text)",
                                border: "1.5px solid var(--status-frozen-border)",
                              }}
                            >🔒</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-sm font-bold px-3 py-1.5 rounded-xl"
                          style={{
                            color: "var(--text)",
                            backgroundColor: "var(--surface-2)",
                            border: "1.5px solid var(--border)",
                          }}
                        >{req.clientType ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <MapPin size={15} style={{ color: "var(--brand)" }} className="shrink-0" />
                          <span style={{ color: "var(--text)" }}>{req.homeLocation}</span>
                          <span style={{ color: "var(--text-hint)" }}>←</span>
                          <span style={{ color: "var(--text)" }}>{req.workLocation}</span>
                        </div>
                        {req.additionalLocations?.map((loc) => (
                          <p key={`${loc.type}-${loc.address}`} className="text-xs mt-1.5 font-bold" style={{ color: "var(--text-muted)" }}>📍 {loc.type === "pickup" ? "استلام" : "توصيل"}: {loc.address}</p>
                        ))}
                        {req.client && <p className="text-xs mt-1.5 font-bold" style={{ color: "var(--text-muted)" }}>👤 {req.client.name} — {req.client.mobile}</p>}
                        {req.phone && <p className="text-xs mt-1.5 font-bold" dir="ltr" style={{ color: "var(--text-muted)" }}>📞 {req.phone}</p>}
                        {req.notes && <p className="text-xs mt-1.5 font-bold" style={{ color: "var(--text-muted)" }}>📝 {req.notes}</p>}
                      </td>
                      <td className="px-5 py-4">
                        {req.shifts && req.shifts.length > 0 ? (
                          <div className="space-y-0.5">
                            {req.shifts.map((s) => (
                              <div key={`${s.label ?? "shift"}-${s.goTime}-${s.returnTime ?? "none"}`} className="flex items-center gap-1 text-xs" dir="ltr">
                                <Clock size={11} style={{ color: "var(--text-hint)" }} />
                                <span className="font-medium">{formatTime12hLong(s.goTime)}{s.returnTime ? ` – ${formatTime12hLong(s.returnTime)}` : ""}</span>
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
                          <Link href={`/admin/requests/${req.id}`}>
                            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                              <Eye size={14} style={{ color: "var(--brand)" }} />
                            </button>
                          </Link>
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
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold" style={{ color: "var(--text-muted)" }}>#{req.id}</span>
                        {req.createdBy === "admin" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-black" style={{ backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)" }}>إداري</span>
                        )}
                        <span className="text-sm px-3 py-0.5 rounded-full font-bold" style={STATUS_PILL_STYLE[req.status] ?? { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                        {getStatusLabel(req.status)}
                        </span>
                        {req.statusManuallySetByAdmin && (
                          <span title="الحالة مثبّتة يدوياً" className="text-xs px-1.5 py-0.5 rounded-full font-black" style={{ backgroundColor: "var(--status-frozen-bg)", color: "var(--status-frozen-text)" }}>🔒</span>
                        )}
                      </div>
                      <p className="mt-2 text-base font-black truncate" style={{ color: "var(--text)" }}>
                        {req.homeLocation} ← {req.workLocation}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {req.clientType && (
                          <span className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
                            {req.clientType}
                          </span>
                        )}
                        {req.selectedDriver && (
                          <span className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>🚗 {req.selectedDriver.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link href={`/admin/requests/${req.id}`}>
                        <button className="w-10 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }} aria-label={`عرض الطلب ${req.id}`}><Eye size={14} style={{ color: "var(--brand)" }} /></button>
                      </Link>
                      <button onClick={() => handleDelete(req)} className="w-10 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }} aria-label={`حذف الطلب ${req.id}`}><Trash2 size={14} style={{ color: "var(--status-cancelled-text)" }} /></button>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    {req.additionalLocations?.map((loc) => (
                      <p key={`${loc.type}-${loc.address}`} className="text-xs" style={{ color: "var(--text-hint)" }}>📍 {loc.type === "pickup" ? "استلام" : "توصيل"}: {loc.address}</p>
                    ))}
                    <div className="grid grid-cols-1 gap-2 rounded-xl p-3 text-sm" style={{ backgroundColor: "var(--surface-2)" }}>
                      {req.shifts && req.shifts.length > 0 ? (
                        <span className="flex items-center gap-1 flex-wrap" dir="ltr">
                          <Clock size={13} />
                          {req.shifts.map((s, i) => (
                            <span key={`${s.label ?? "shift"}-${s.goTime}-${s.returnTime ?? "none"}`}>{formatTime12hLong(s.goTime)}{s.returnTime ? ` – ${formatTime12hLong(s.returnTime)}` : ""}{i < req.shifts.length - 1 ? " |" : ""}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" dir="ltr"><Clock size={13} /> {formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                      )}
                      <span className="flex items-center gap-1"><Users size={13} /> {req.numberOfPeople} · {req.workingDaysPerWeek} أيام</span>
                      {req.client && <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>👤 {req.client.name} — {req.client.mobile}</span>}
                    </div>
                    {req.phone && <p className="text-sm" dir="ltr" style={{ color: "var(--text-muted)" }}>📞 {req.phone}</p>}
                    {req.notes && <p className="text-xs" style={{ color: "var(--text-hint)" }}>📝 {req.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </Layout>
  );
}
