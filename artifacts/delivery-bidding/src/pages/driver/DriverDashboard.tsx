import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, getListRequestsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { EnablePushButton } from "@/components/enable-push-button";
import { AlertTriangle, Clock, Users, CheckCircle, Phone, ChevronLeft } from "lucide-react";
import { MapButtons } from "@/components/MapButtons";
import { LocationDisplay } from "@/components/LocationDisplay";
import { formatTime12hLong } from "@/lib/time-utils";
import { toast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN as API } from "@/lib/api-config";

type TabId = "agreements" | "available";

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
        description: `تم قبولك في اتفاقية #${job.id} — ${job.homeLocation} ← ${job.workLocation}`,
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
    { id: "agreements", label: "الاتفاقيات", icon: "🤝", count: mySelectedJobs.length },
    { id: "available", label: "فرص جديدة", icon: "📋", count: openRequests?.length },
  ];

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-5">
        {/* Driver info card */}
        {driver && (
          <div
            className="rounded-3xl p-6 mb-6 transition-all hover:shadow-lg"
            style={{
              backgroundColor: "var(--surface)",
              border: "1.5px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-end mb-5">
              <div
                className={`text-right px-5 py-3 rounded-2xl transition-all ${hasEnoughBalance ? "" : "border-2 border-red-500/40"}`}
                style={{
                  backgroundColor: hasEnoughBalance ? "var(--brand-subtle)" : "var(--status-cancelled-bg)",
                  border: hasEnoughBalance ? "1.5px solid var(--brand-border)" : undefined,
                }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>الرصيد</p>
                <p className="font-black text-xl" style={{ color: hasEnoughBalance ? "var(--brand)" : "var(--status-cancelled-text)" }} dir="ltr">{driver.balance.toFixed(0)} ر.س</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "دخل شهري", value: totalEarnings > 0 ? (totalEarnings >= 1000 ? `${(totalEarnings / 1000).toFixed(1)}K` : totalEarnings.toFixed(0)) : "—" },
                { label: "اتفاقيات نشطة", value: String(mySelectedJobs.length) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 text-center transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1.5px solid var(--border)",
                  }}
                >
                  <p className="font-black text-2xl leading-tight" style={{ color: "var(--brand)" }}>{stat.value}</p>
                  <p className="text-xs mt-1 leading-tight font-bold" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low balance warning */}
        {!hasEnoughBalance && driver && (
          <div
            className="flex items-start gap-3 rounded-2xl px-5 py-4 mb-5 transition-all"
            style={{
              backgroundColor: "var(--status-open-bg)",
              border: "1.5px solid var(--status-open-border)",
            }}
          >
            <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: "var(--status-open-text)" }} />
            <div>
              <p className="font-black text-sm" style={{ color: "var(--status-open-text)" }}>رصيد غير كافٍ</p>
              <p className="text-sm mt-1 font-bold" style={{ color: "var(--text-muted)" }}>
                تحتاج 50 ريال كحد أدنى لتقديم عروض. رصيدك الحالي: <strong dir="ltr" style={{ color: "var(--status-open-text)" }}>{driver.balance.toFixed(2)} ر.س</strong>
              </p>
            </div>
          </div>
        )}

        {/* Push notifications opt-in */}
        <div className="mb-4">
          <EnablePushButton />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all hover:shadow-md"
              style={activeTab === tab.id
                ? {
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-fg)",
                    border: "1.5px solid var(--brand)",
                  }
                : {
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text-muted)",
                    border: "1.5px solid var(--border)",
                  }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="text-xs rounded-full px-2 py-0.5 font-black leading-none"
                  style={activeTab === tab.id
                    ? {
                        backgroundColor: "rgba(255,255,255,0.25)",
                        color: "var(--brand-fg)",
                      }
                    : {
                        backgroundColor: "var(--brand-subtle)",
                        color: "var(--brand)",
                        border: "1px solid var(--brand-border)",
                      }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Available ── */}
        {activeTab === "available" && (
          <>
            {isLoading && <div className="text-center py-20 font-bold" style={{ color: "var(--text-muted)" }}>جاري تحميل الفرص...</div>}
            {!isLoading && (!openRequests || openRequests.length === 0) && (
              <div
                className="text-center py-20 rounded-3xl transition-all hover:shadow-sm"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "2px dashed var(--border)",
                }}
              >
                <p className="text-4xl mb-3">📋</p>
                <p className="text-xl font-black" style={{ color: "var(--text)" }}>لا توجد فرص متاحة</p>
                <p className="font-bold text-sm mt-2" style={{ color: "var(--text-muted)" }}>تحقق لاحقاً لفرص دوام جديدة</p>
              </div>
            )}
            {openRequests && openRequests.length > 0 && (
              <div className="space-y-5">
                {openRequests.map((req) => {
                  const clientTypeLabel = (req as any).clientType || "طلب توصيل";
                  const emoji = CLIENT_TYPE_EMOJI[clientTypeLabel] ?? "📦";
                  const offerCount = (req as any).offerCount ?? 0;
                  return (
                    <div
                      key={req.id}
                      className="rounded-3xl overflow-hidden transition-all hover:shadow-lg"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "2px solid #E5E7EB",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                      }}
                    >
                      {/* Card header */}
                      <div
                        className="p-6"
                        style={{
                          backgroundColor: "#F9FAFB",
                          borderBottom: "2px solid #E5E7EB",
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{emoji}</span>
                            <div>
                              <p className="font-black text-2xl tracking-tight" style={{ color: "#111827" }}>{clientTypeLabel}</p>
                              <p className="text-sm font-bold" style={{ color: "#6B7280" }}>REQ-{String(req.id).padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div
                            className="rounded-2xl px-5 py-4 text-center"
                            style={{
                              backgroundColor: "#EFF6FF",
                              border: "2px solid #3B82F6",
                              minWidth: "100px",
                            }}
                          >
                            <p className="font-black text-5xl leading-none" style={{ color: "#1D4ED8" }} dir="ltr">
                              {((req as any).monthlyPrice ?? 0).toFixed(0)}
                            </p>
                            <p className="text-sm font-bold mt-1" style={{ color: "#6B7280" }}>ر.س / شهر</p>
                            {(req as any).numberOfPeople > 1 && (
                              <div
                                className="mt-2 pt-2"
                                style={{
                                  borderTop: "2px solid #DBEAFE",
                                }}
                              >
                                <p className="font-black text-xl leading-none" style={{ color: "#111827" }} dir="ltr">
                                  {((req as any).monthlyPrice / (req as any).numberOfPeople).toFixed(0)}
                                </p>
                                <p className="text-sm font-bold mt-1" style={{ color: "#6B7280" }}>ر.س / شخص</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-5">
                        <div className="space-y-4 relative pr-4">
                          <div
                            className="absolute right-[7px] top-5 bottom-5 w-[3px] rounded-full"
                            style={{
                              backgroundColor: "var(--border)",
                            }}
                          />
                          <div className="flex items-start gap-3 relative z-10">
                            <div
                              className="w-5 h-5 rounded-full mt-0.5 shrink-0 flex items-center justify-center"
                              style={{
                                backgroundColor: "#10B981",
                                border: "2px solid #FFFFFF",
                                boxShadow: "0 0 0 2px #10B981",
                              }}
                            />
                            <div>
                              <p className="text-sm font-bold mb-1" style={{ color: "#6B7280" }}>من (المنطلق)</p>
                              <p className="text-lg font-black" style={{ color: "#111827" }}><LocationDisplay value={req.homeLocation} className="text-lg font-black" style={{ color: "#111827" }} /></p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 relative z-10">
                            <div
                              className="w-5 h-5 rounded-full mt-0.5 shrink-0 flex items-center justify-center"
                              style={{
                                backgroundColor: "#EF4444",
                                border: "2px solid #FFFFFF",
                                boxShadow: "0 0 0 2px #EF4444",
                              }}
                            />
                            <div>
                              <p className="text-sm font-bold mb-1" style={{ color: "#6B7280" }}>إلى (الوصول)</p>
                              <p className="text-lg font-black" style={{ color: "#111827" }}><LocationDisplay value={req.workLocation} className="text-lg font-black" style={{ color: "#111827" }} /></p>
                            </div>
                          </div>
                        </div>

                        {/* ── الأوقات الموحدة ── */}
                        {(() => {
                          const shifts = (req as any).shifts as Array<{ label?: string; goTime?: string; returnTime?: string }> | null;
                          const hasShifts = shifts && shifts.length > 0;
                          const shiftRows = hasShifts
                            ? shifts!.map((s, i) => ({ label: s.label ?? `الوردية ${i + 1}`, go: s.goTime ?? "", back: s.returnTime ?? "" }))
                            : [{ label: "الوردية الأولى", go: req.morningTime, back: req.eveningTime ?? "" }];
                          return (
                            <div className="space-y-3">
                              {shiftRows.map((s, i) => (
                                <div
                                  key={i}
                                  className="rounded-2xl overflow-hidden"
                                  style={{
                                    border: "2px solid #E5E7EB",
                                    backgroundColor: "#F9FAFB",
                                  }}
                                >
                                  <div
                                    className="px-4 py-2 text-center"
                                    style={{
                                      backgroundColor: "#EFF6FF",
                                      borderBottom: "2px solid #DBEAFE",
                                    }}
                                  >
                                    <p className="text-sm font-black tracking-wide" style={{ color: "#1D4ED8" }}>{s.label}</p>
                                  </div>
                                  <div className="grid gap-px" style={{ gridTemplateColumns: s.back ? "1fr 1fr" : "1fr", backgroundColor: "#E5E7EB" }}>
                                    <div className="px-4 py-3.5 text-right" style={{ backgroundColor: "#FFFFFF" }}>
                                      <p className="text-sm font-black mb-1.5" style={{ color: "#6B7280" }}>الذهاب</p>
                                      <p className="text-xl font-black" style={{ color: "#111827" }} dir="ltr">{formatTime12hLong(s.go)}</p>
                                    </div>
                                    {s.back && (
                                      <div className="px-4 py-3.5 text-right" style={{ backgroundColor: "#FFFFFF" }}>
                                        <p className="text-sm font-black mb-1.5" style={{ color: "#6B7280" }}>العودة</p>
                                        <p className="text-xl font-black" style={{ color: "#111827" }} dir="ltr">{formatTime12hLong(s.back)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <div
                                className="rounded-2xl px-5 py-4 flex items-center justify-between"
                                style={{
                                  backgroundColor: "#F9FAFB",
                                  border: "2px solid #E5E7EB",
                                }}
                              >
                                <p className="text-base font-black" style={{ color: "#6B7280" }}>عدد الأشخاص</p>
                                <p className="text-3xl font-black" style={{ color: "#1D4ED8" }}>{req.numberOfPeople}</p>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex gap-1.5 flex-wrap">
                          {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                            <span key={d} className="text-sm px-3 py-2 rounded-full font-black"
                              style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "2px solid #3B82F6" }}>
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* أزرار الخريطة */}
                        <MapButtons
                          homeLat={(req as any).homeLat}
                          homeLng={(req as any).homeLng}
                          destLat={(req as any).destLat}
                          destLng={(req as any).destLng}
                        />

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

        {/* ── Tab: Agreements ── */}
        {activeTab === "agreements" && (
          <div className="space-y-4">
            {mySelectedJobs.length === 0 && (
              <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
                <p className="text-4xl mb-3">🗓️</p>
                <p className="text-xl font-black" style={{ color: "var(--text)" }}>لا توجد اتفاقيات نشطة</p>
                <p className="font-bold text-sm mt-1" style={{ color: "var(--text-hint)" }}>ستظهر هنا اتفاقياتك بعد قبولك من العملاء</p>
              </div>
            )}
            {mySelectedJobs.map((req) => (
              <div
                key={req.id}
                className="rounded-3xl overflow-hidden transition-all hover:shadow-lg"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #E5E7EB",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
              >
                <div className="p-5" style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} style={{ color: "var(--brand)" }} />
                      <span className="font-black text-sm" style={{ color: "#1D4ED8" }}>اتفاقية نشطة</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#6B7280" }}>REQ-{String(req.id).padStart(3, "0")}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#10B981" }} />
                       <LocationDisplay value={req.homeLocation} className="text-sm font-black" style={{ color: "#111827" }} />
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#EF4444" }} />
                       <LocationDisplay value={req.workLocation} className="text-sm font-black" style={{ color: "#111827" }} />
                    </div>
                  </div>
                  {(req as any).shifts && (req as any).shifts.length > 0 ? (
                    <div className="space-y-1.5 mt-4">
                       {((req as any).shifts as Array<{ label?: string; goTime?: string; returnTime?: string }>).map((s, i) => (
                         <div key={i} className="px-3 py-2 rounded-xl" style={{ backgroundColor: "#FFFFFF", border: "2px solid #E5E7EB" }}>
                           <p className="text-[10px] font-black mb-1" style={{ color: "#6B7280" }}>{s.label ?? `الوردية ${i + 1}`}</p>
                           <div className="space-y-1 text-xs font-bold" style={{ color: "#111827" }}>
                             <p dir="ltr">الذهاب: {formatTime12hLong(s.goTime ?? "")}</p>
                             {s.returnTime && <p dir="ltr">العودة: {formatTime12hLong(s.returnTime)}</p>}
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "#FFFFFF", border: "2px solid #E5E7EB" }}>
                        <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>الذهاب</p>
                        <p className="font-black text-sm" dir="ltr" style={{ color: "#111827" }}>{formatTime12hLong(req.morningTime)}</p>
                      </div>
                      {req.eveningTime && (
                        <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "#FFFFFF", border: "2px solid #E5E7EB" }}>
                          <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>العودة</p>
                          <p className="font-black text-sm" dir="ltr" style={{ color: "#111827" }}>{formatTime12hLong(req.eveningTime)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(req as any).monthlyPrice != null && (req as any).monthlyPrice > 0 && (
                    <div className="flex items-center justify-between mt-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "#EFF6FF", border: "2px solid #3B82F6" }}>
                      <div>
                        <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>
                          {(req as any).numberOfPeople > 1 ? "السعر / شخص" : "السعر الشهري"}
                        </p>
                        <p className="font-black text-lg" style={{ color: "#1D4ED8" }} dir="ltr">
                          {(req as any).numberOfPeople > 1
                            ? ((req as any).monthlyPrice / (req as any).numberOfPeople).toFixed(0)
                            : (req as any).monthlyPrice.toFixed(0)}{" "}ر.س
                        </p>
                      </div>
                      {(req as any).numberOfPeople > 1 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>الإجمالي ({(req as any).numberOfPeople} أشخاص)</p>
                          <p className="font-black text-base" style={{ color: "#111827" }} dir="ltr">{(req as any).monthlyPrice.toFixed(0)} ر.س/شهر</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                      <span key={d} className="text-xs px-2.5 py-1 rounded-full font-black"
                        style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "2px solid #3B82F6" }}>
                        {d}
                      </span>
                    ))}
                  </div>
                  {req.phone && (
                    <div className="flex items-center gap-3 pt-3" style={{ borderTop: "2px solid #E5E7EB" }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                        style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8" }}>
                        {req.selectedDriver?.name?.charAt(0) ?? "ع"}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>العميل</p>
                        <a href={`tel:${req.phone}`} className="text-sm font-black" dir="ltr" style={{ color: "#111827" }}>{req.phone}</a>
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
