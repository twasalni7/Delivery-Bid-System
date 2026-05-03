import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, getListRequestsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { EnablePushButton } from "@/components/enable-push-button";
import { AlertTriangle, Clock, Users, CheckCircle, Phone, ChevronLeft } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type TabId = "schedule" | "available";

const DAYS_FULL = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼", طلاب: "🎓", مدارس: "🏫", جامعات: "🎓", معلمات: "📚", غيره: "📦",
};

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allRequests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 30_000 } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" }, { query: { refetchInterval: 30_000 } as any });
  const openRequests = allRequests?.filter((r) => r.status === "OPEN");

  const [activeTab, setActiveTab] = useState<TabId>("available");

  const prevSelectedIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  useEffect(() => {
    if (!user || !selectedRequests) return;
    const myJobs = selectedRequests.filter((r) => r.selectedDriverId === Number(user.id));
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
  }, [selectedRequests, user]);

  // Supabase Realtime — listen for new ride requests and refresh the list instantly
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let realtimeChannel: import("@supabase/supabase-js").RealtimeChannel | null = null;

    import("@/lib/supabase").then(({ getSupabase }) => {
      if (cancelled) return;
      try {
        const supabase = getSupabase();
        realtimeChannel = supabase
          .channel("requests-realtime")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "requests" },
            () => {
              queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
              toast({ title: "🔔 طلب جديد!", description: "تم إضافة طلب مشوار جديد" });
            }
          )
          .subscribe();
      } catch {
        // Supabase not configured — polling via refetchInterval is used as fallback
      }
    });

    return () => {
      cancelled = true;
      if (realtimeChannel) {
        import("@/lib/supabase")
          .then(({ getSupabase }) => {
            try { getSupabase().removeChannel(realtimeChannel!); } catch { /* ignore */ }
          })
          .catch(() => {});
      }
    };
  }, [user, queryClient]);

  if (!user) return null;

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;
  const mySelectedJobs = selectedRequests?.filter((r) => r.selectedDriverId === Number(user.id)) ?? [];

  const totalEarnings = mySelectedJobs.reduce((sum, r) => sum + ((r as any).monthlyPrice ?? 0), 0);

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "schedule", label: "جدولي", icon: "🗓️", count: mySelectedJobs.length },
    { id: "available", label: "طلبات جديدة", icon: "📋", count: openRequests?.length },
  ];

  return (
    <Layout role="driver">
      <div dir="rtl">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-[1.9rem] font-black text-white tracking-tight">لوحة السائق</h1>
          <p className="font-bold text-sm mt-1" style={{ color: "var(--text-muted)" }}>الاشتراكات والطلبات</p>
        </div>

        {/* Driver info card */}
        {driver && (
          <div className="rounded-3xl p-5 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white font-black text-xl tracking-tight">{driver.name}</p>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>سائق توصّلني</p>
              </div>
              <div className={`text-right px-4 py-2.5 rounded-2xl ${hasEnoughBalance ? "" : "border border-red-500/30"}`}
                style={{ backgroundColor: hasEnoughBalance ? "var(--brand-subtle)" : "rgba(248,113,113,0.08)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>الرصيد</p>
                <p className="font-black text-lg" style={{ color: hasEnoughBalance ? "var(--brand)" : "#f87171" }} dir="ltr">{driver.balance.toFixed(0)} ر.س</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "دخل شهري", value: totalEarnings > 0 ? (totalEarnings >= 1000 ? `${(totalEarnings / 1000).toFixed(1)}K` : totalEarnings.toFixed(0)) : "—" },
                { label: "اشتراكات نشطة", value: String(mySelectedJobs.length) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-white font-black text-xl leading-tight">{stat.value}</p>
                  <p className="text-xs mt-0.5 leading-tight font-bold" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low balance warning */}
        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 rounded-2xl px-5 py-4 mb-6" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-amber-300 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-400/80 text-sm mt-0.5 font-bold">
                تحتاج 50 ريال كحد أدنى لتقديم عروض. رصيدك الحالي: <strong dir="ltr">{driver.balance.toFixed(2)} ر.س</strong>
              </p>
            </div>
          </div>
        )}

        {/* Push notifications opt-in */}
        <div className="mb-5">
          <EnablePushButton />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all"
              style={activeTab === tab.id
                ? { backgroundColor: "var(--brand)", color: "var(--bg)" }
                : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs rounded-full px-2 py-0.5 font-black leading-none"
                  style={activeTab === tab.id
                    ? { backgroundColor: "rgba(0,0,0,0.2)", color: "var(--bg)" }
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
                <p className="text-xl font-black text-white">لا توجد طلبات مفتوحة</p>
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
                    <div key={req.id} className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                      {/* Card header */}
                      <div className="p-5" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{emoji}</span>
                            <div>
                              <p className="text-white font-black text-lg tracking-tight">{clientTypeLabel}</p>
                              <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>REQ-{String(req.id).padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl px-4 py-2 text-center" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                            <p className="font-black text-2xl" style={{ color: "var(--brand)" }} dir="ltr">{(req as any).monthlyPrice?.toFixed(0) ?? "—"}</p>
                            <p className="text-xs font-bold" style={{ color: "var(--brand)" }}>ريال/شهر</p>
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
                              <p className="text-sm text-white font-black">{req.homeLocation}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 relative z-10">
                            <div className="w-4 h-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#f87171", boxShadow: "0 0 8px rgba(248,113,113,0.4)" }} />
                            <div>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>إلى (الوصول)</p>
                              <p className="text-sm text-white font-black">{req.workLocation}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Clock size={12} /></div>
                            <p className="text-xs font-black text-white" dir="ltr">{formatTime12h(req.morningTime)}</p>
                            <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>الذهاب</p>
                          </div>
                          {req.eveningTime && (
                            <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Clock size={12} /></div>
                              <p className="text-xs font-black text-white" dir="ltr">{formatTime12h(req.eveningTime)}</p>
                              <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>العودة</p>
                            </div>
                          )}
                          <div className="text-center rounded-xl p-2.5" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: "var(--text-hint)" }}><Users size={12} /></div>
                            <p className="text-xs font-black text-white">{req.numberOfPeople}</p>
                            <p className="text-[10px] font-bold" style={{ color: "var(--text-hint)" }}>أشخاص</p>
                          </div>
                        </div>

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

                        <div className="pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          {hasEnoughBalance ? (
                            <Link href={`/driver/request/${req.id}`}>
                              <div className="btn-primary w-full">
                                قدم عرضك الشهري
                                <ChevronLeft size={16} style={{ color: "rgba(0,0,0,0.5)" }} aria-hidden="true" />
                              </div>
                            </Link>
                          ) : (
                            <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
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
                <p className="text-xl font-black text-white">لا توجد اشتراكات نشطة</p>
                <p className="font-bold text-sm mt-1" style={{ color: "var(--text-hint)" }}>ستظهر هنا اشتراكاتك بعد اختيارك من العملاء</p>
              </div>
            )}
            {mySelectedJobs.map((req) => (
              <div key={req.id} className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--brand-border)" }}>
                <div className="p-5" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
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
                      <p className="text-sm font-black text-white">{req.homeLocation}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: "#f87171" }} />
                      <p className="text-sm font-black text-white">{req.workLocation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                      <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>الذهاب</p>
                      <p className="text-white font-black text-sm" dir="ltr">{formatTime12h(req.morningTime)}</p>
                    </div>
                    {req.eveningTime && (
                      <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>العودة</p>
                        <p className="text-white font-black text-sm" dir="ltr">{formatTime12h(req.eveningTime)}</p>
                      </div>
                    )}
                  </div>
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
                        <a href={`tel:${req.phone}`} className="text-sm font-black text-white" dir="ltr">{req.phone}</a>
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
