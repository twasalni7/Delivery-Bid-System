import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, getListRequestsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { AlertTriangle, Clock, Users, CheckCircle, Phone, ChevronLeft } from "lucide-react";
import { formatTime12hLong } from "@/lib/time-utils";
import { toast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN as API } from "@/lib/api-config";

type TabId = "schedule" | "available";

const DAYS_FULL = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼", طلاب: "🎓", مدارس: "🏫", جامعات: "🎓", معلمات: "📚", غيره: "📦",
};

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allRequests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 15_000 } as any });
  const { data: myRequests } = useQuery({
    queryKey: ["driver-me-requests-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/drivers/me/requests`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل جلب طلبات السائق");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const openRequests = allRequests?.filter((r) => r.status === "OPEN");

  const [activeTab, setActiveTab] = useState<TabId>("available");

  const prevSelectedIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  useEffect(() => {
    if (!user || !myRequests) return;
    const myJobs = myRequests.filter((r: any) => r.selectedDriverId === Number(user.id) && (r.status === "ACTIVE" || r.status === "SELECTED"));
    const currentIds = new Set<number>(myJobs.map((j) => Number(j.id)));
    if (prevSelectedIdsRef.current === null) {
      prevSelectedIdsRef.current = currentIds;
      return;
    }
    const newlyAccepted = myJobs.filter((j) => !prevSelectedIdsRef.current!.has(j.id));
    newlyAccepted.forEach((job) => {
      toast({
        title: "🎉 تم اختيارك!",
        description: `تم اختيارك لطلب #${job.id} — ${job.homeLocation} ← ${job.workLocation}`,
      });
    });
    prevSelectedIdsRef.current = currentIds;
  }, [myRequests, user]);

  // Supabase Realtime — listen for new and updated ride requests and refresh instantly
  useRealtimeRefresh(
    "driver-dashboard-realtime",
    [{ table: "requests", events: ["INSERT", "UPDATE"] }],
    [getListRequestsQueryKey(), ["driver-me-requests-dashboard"]],
    !!user
  );

  // Toast on new INSERT events (kept via separate effect listening to open requests)
  const prevOpenCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!allRequests) return;
    const openCount = allRequests.filter((r) => r.status === "OPEN").length;
    if (prevOpenCountRef.current !== null && openCount > prevOpenCountRef.current) {
      toast({ title: "🔔 طلب جديد!", description: "تم إضافة طلب مشوار جديد" });
    }
    prevOpenCountRef.current = openCount;
  }, [allRequests]);

  if (!user) return null;

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;
  const mySelectedJobs = (myRequests ?? []).filter((r: any) => r.selectedDriverId === Number(user.id) && (r.status === "ACTIVE" || r.status === "SELECTED"));

  const totalEarnings = mySelectedJobs.reduce((sum, r) => sum + ((r as any).monthlyPrice ?? 0), 0);

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "schedule", label: "جدولي", icon: "🗓️", count: mySelectedJobs.length },
    { id: "available", label: "طلبات جديدة", icon: "📋", count: openRequests?.length },
  ];

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-5">
        {/* Driver info card */}
        {driver && (
          <div className="rounded-3xl p-5 mb-5" style={{ background: "linear-gradient(155deg, rgba(20,31,50,0.8) 0%, rgba(9,13,22,0.95) 58%, rgba(6,10,16,0.98) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-end mb-5">
              <div className={`text-right px-4 py-2.5 rounded-2xl ${hasEnoughBalance ? "" : "border border-red-500/30"}`}
                style={{ backgroundColor: hasEnoughBalance ? "var(--brand-subtle)" : "var(--status-cancelled-bg)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>الرصيد</p>
                <p className="font-black text-lg" style={{ color: hasEnoughBalance ? "var(--brand)" : "var(--status-cancelled-text)" }} dir="ltr">{driver.balance.toFixed(0)} ر.س</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "دخل شهري", value: totalEarnings > 0 ? (totalEarnings >= 1000 ? `${(totalEarnings / 1000).toFixed(1)}K` : totalEarnings.toFixed(0)) : "—" },
                { label: "اشتراكات نشطة", value: String(mySelectedJobs.length) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                  <p className="font-black text-xl leading-tight" style={{ color: "var(--text)" }}>{stat.value}</p>
                  <p className="text-xs mt-0.5 leading-tight font-bold" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low balance warning */}
        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 rounded-2xl px-5 py-4 mb-5" style={{ backgroundColor: "rgba(217,119,6,0.18)", border: "1px solid rgba(217,119,6,0.35)" }}>
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-amber-300 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-400/80 text-sm mt-0.5 font-bold">
                تحتاج 50 ريال كحد أدنى لتقديم عروض. رصيدك الحالي: <strong dir="ltr">{driver.balance.toFixed(2)} ر.س</strong>
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all"
              style={activeTab === tab.id
                ? { background: "linear-gradient(180deg, #ea1e3f 0%, #cf1232 100%)", color: "var(--brand-fg)" }
                : { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs rounded-full px-2 py-0.5 font-black leading-none"
                  style={activeTab === tab.id
                    ? { backgroundColor: "rgba(0,0,0,0.2)", color: "var(--brand-fg)" }
                    : { backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Available ── */}
        {activeTab === "available" && (
          <>
            {isLoading && <div className="text-center py-20 font-bold" style={{ color: "var(--text-hint)" }}>جاري تحميل الطلبات...</div>}
            {!isLoading && (!openRequests || openRequests.length === 0) && (
              <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
                <p className="text-4xl mb-3">📋</p>
                <p className="text-xl font-black" style={{ color: "var(--text)" }}>لا توجد طلبات مفتوحة</p>
                <p className="font-bold text-sm mt-1" style={{ color: "var(--text-hint)" }}>تحقق لاحقاً لعروض دوام جديدة</p>
              </div>
            )}
            {openRequests && openRequests.length > 0 && (
              <div className="space-y-5">
                {openRequests.map((req) => {
                  const clientTypeLabel = (req as any).clientType || "طلب توصيل";
                  const emoji = CLIENT_TYPE_EMOJI[clientTypeLabel] ?? "📦";
                  const offerCount = (req as any).offerCount ?? 0;
                  return (
                    <div key={req.id} className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(150deg, rgba(20,31,50,0.8) 0%, rgba(9,13,22,0.95) 55%, rgba(6,10,16,0.98) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {/* Card header */}
                      <div className="p-5" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{emoji}</span>
                            <div>
                              <p className="font-black text-lg tracking-tight" style={{ color: "var(--text)" }}>{clientTypeLabel}</p>
                              <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>REQ-{String(req.id).padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl px-4 py-2 text-center" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)", minWidth: "88px" }}>
                            {(req as any).numberOfPeople > 1 ? (
                              <>
                                <p className="font-black text-2xl" style={{ color: "var(--brand)" }} dir="ltr">
                                  {((req as any).monthlyPrice / (req as any).numberOfPeople).toFixed(0)}
                                </p>
                                <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>ر.س/شخص/شهر</p>
                                <p className="text-[10px] font-black mt-0.5" style={{ color: "var(--text-muted)" }} dir="ltr">
                                  إجمالي: {(req as any).monthlyPrice?.toFixed(0) ?? "—"} ر.س
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-black text-2xl" style={{ color: "var(--brand)" }} dir="ltr">{(req as any).monthlyPrice?.toFixed(0) ?? "—"}</p>
                                <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>ريال/شهر</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="space-y-3 relative pr-3">
                          <div className="absolute right-[5px] top-4 bottom-4 w-[2px] rounded-full" style={{ backgroundColor: "var(--border-subtle)" }} />
                          <div className="flex items-start gap-3 relative z-10">
                            <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "var(--brand)", boxShadow: "0 0 8px rgba(222,255,154,0.4)" }} />
                            <div>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>من (المنطلق)</p>
                              <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.homeLocation}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 relative z-10">
                            <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "var(--status-cancelled-text)", boxShadow: "0 0 8px rgba(248,113,113,0.4)" }} />
                            <div>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>إلى (الوصول)</p>
                              <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.workLocation}</p>
                            </div>
                          </div>
                        </div>

                        {/* Shift / time display */}
                        {(req as any).shifts && (req as any).shifts.length > 0 ? (
                          <div className="space-y-1.5">
                            {((req as any).shifts as Array<{ label?: string; goTime?: string; returnTime?: string }>).map((s, i) => (
                              <div key={i} className="px-2.5 py-2 rounded-xl" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                                <p className="text-[10px] font-black mb-1" style={{ color: "var(--text-hint)" }}>{s.label ?? `الوردية ${i + 1}`}</p>
                                <div className="space-y-1 text-xs font-bold" style={{ color: "var(--text)" }}>
                                  <p dir="ltr">الذهاب: {formatTime12hLong(s.goTime ?? "")}</p>
                                  {s.returnTime && <p dir="ltr">العودة: {formatTime12hLong(s.returnTime)}</p>}
                                </div>
                              </div>
                            ))}
                            <div className="text-center rounded-xl p-2" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                              <p className="text-xs font-black" style={{ color: "var(--text)" }}>{req.numberOfPeople}</p>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>أشخاص</p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Clock size={12} /></div>
                              <p className="text-xs font-black" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12hLong(req.morningTime)}</p>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>الذهاب</p>
                            </div>
                            {req.eveningTime && (
                              <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Clock size={12} /></div>
                                <p className="text-xs font-black" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12hLong(req.eveningTime)}</p>
                                <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>العودة</p>
                              </div>
                            )}
                            <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Users size={12} /></div>
                              <p className="text-xs font-black" style={{ color: "var(--text)" }}>{req.numberOfPeople}</p>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>أشخاص</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-1.5 flex-wrap">
                          {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                            <span key={d} className="text-xs px-2.5 py-1 rounded-full font-black"
                              style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>
                              {d}
                            </span>
                          ))}
                        </div>

                        {offerCount > 0 && (
                          <div className="flex items-center justify-between text-xs font-black pt-1" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                            <span>عدد العروض المقدمة</span>
                            <span style={{ color: "var(--brand)" }}>{offerCount} عروض</span>
                          </div>
                        )}

                        <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          {hasEnoughBalance ? (
                            <Link href={`/driver/request/${req.id}`}>
                              <div className="btn-primary w-full">
                                قدم عرضك الشهري
                                <ChevronLeft size={16} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
                              </div>
                            </Link>
                          ) : (
                            <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
                              <p className="text-center text-sm font-black text-red-400 mb-2">⚠️ رصيدك غير كافٍ لتقديم عرض</p>
                              <p className="text-center text-xs text-red-400/70 mb-3">تحتاج 50 ريال كحد أدنى</p>
                              <button
                                onClick={() => setLocation("/driver/profile")}
                                className="btn-primary w-full"
                              >
                                💳 اشحن محفظتك الآن
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Schedule ── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {mySelectedJobs.length === 0 && (
              <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
                <p className="text-4xl mb-3">🗓️</p>
                <p className="text-xl font-black" style={{ color: "var(--text)" }}>لا توجد اشتراكات نشطة</p>
                <p className="font-bold text-sm mt-1" style={{ color: "var(--text-hint)" }}>ستظهر هنا اشتراكاتك بعد اختيارك من العملاء</p>
              </div>
            )}
            {mySelectedJobs.map((req) => (
              <div key={req.id} className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(150deg, rgba(20,31,50,0.8) 0%, rgba(9,13,22,0.95) 55%, rgba(6,10,16,0.98) 100%)", border: "1px solid var(--brand-border)" }}>
                <div className="p-5" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} style={{ color: "var(--brand)" }} />
                      <span className="font-black text-sm" style={{ color: "var(--brand)" }}>اشتراك نشط</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>REQ-{String(req.id).padStart(3, "0")}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                      <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.homeLocation}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "var(--status-cancelled-text)" }} />
                      <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.workLocation}</p>
                    </div>
                  </div>
                  {/* Shift / time display for active job */}
                  {(req as any).shifts && (req as any).shifts.length > 0 ? (
                    <div className="space-y-1.5 mt-4">
                      {((req as any).shifts as Array<{ label?: string; goTime?: string; returnTime?: string }>).map((s, i) => (
                        <div key={i} className="px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                          <p className="text-[10px] font-black mb-1" style={{ color: "var(--text-hint)" }}>{s.label ?? `الوردية ${i + 1}`}</p>
                          <div className="space-y-1 text-xs font-bold" style={{ color: "var(--text)" }}>
                            <p dir="ltr">الذهاب: {formatTime12hLong(s.goTime ?? "")}</p>
                            {s.returnTime && <p dir="ltr">العودة: {formatTime12hLong(s.returnTime)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>الذهاب</p>
                        <p className="font-black text-sm" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12hLong(req.morningTime)}</p>
                      </div>
                      {req.eveningTime && (
                        <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                          <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>العودة</p>
                          <p className="font-black text-sm" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12hLong(req.eveningTime)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Price breakdown in schedule card */}
                  {(req as any).monthlyPrice != null && (req as any).monthlyPrice > 0 && (
                    <div className="flex items-center justify-between mt-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                      <div>
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>
                          {(req as any).numberOfPeople > 1 ? "السعر / شخص" : "السعر الشهري"}
                        </p>
                        <p className="font-black text-lg" style={{ color: "var(--brand)" }} dir="ltr">
                          {(req as any).numberOfPeople > 1
                            ? ((req as any).monthlyPrice / (req as any).numberOfPeople).toFixed(0)
                            : (req as any).monthlyPrice.toFixed(0)}{" "}ر.س
                        </p>
                      </div>
                      {(req as any).numberOfPeople > 1 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>الإجمالي ({(req as any).numberOfPeople} أشخاص)</p>
                          <p className="font-black text-base" style={{ color: "var(--text-sub)" }} dir="ltr">{(req as any).monthlyPrice.toFixed(0)} ر.س/شهر</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                      <span key={d} className="text-xs px-2.5 py-1 rounded-full font-black"
                        style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {req.phone && (
                    <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                        style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                        {req.selectedDriver?.name?.charAt(0) ?? "ع"}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>العميل</p>
                        <a href={`tel:${req.phone}`} className="text-sm font-black" dir="ltr" style={{ color: "var(--text)" }}>{req.phone}</a>
                      </div>
                      <a href={`tel:${req.phone}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black"
                        style={{ backgroundColor: "#25D366", color: "#fff" }}>
                        <Phone size={13} /> اتصال
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
