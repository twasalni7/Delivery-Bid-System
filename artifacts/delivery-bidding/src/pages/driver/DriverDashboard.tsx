import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, useListMyOffers, useWithdrawOffer, getListRequestsQueryKey } from "@workspace/api-client-react";
import type { DriverOffer } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { EnablePushButton } from "@/components/enable-push-button";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle, Phone, FileText, Trash2, X, Check, ChevronLeft } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type TabId = "earnings" | "schedule" | "my-offers" | "available";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الجم", "الس"];
const DAYS_FULL = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼", طلاب: "🎓", مدارس: "🏫", جامعات: "🎓", معلمات: "📚", غيره: "📦",
};

const OFFER_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING:   { label: "قيد المراجعة", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  SELECTED:  { label: "تم القبول",    className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  CANCELLED: { label: "ملغى",         className: "bg-red-100 text-red-500 border border-red-200" },
};

const WEEKS_PER_MONTH = 4;

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allRequests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 30_000 } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" }, { query: { refetchInterval: 30_000 } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myOffers, isLoading: offersLoading } = useListMyOffers({ query: { enabled: !!user, refetchInterval: 30_000 } as any });
  const openRequests = allRequests?.filter((r) => r.status === "OPEN");

  const [activeTab, setActiveTab] = useState<TabId>("available");
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<number | null>(null);

  const withdrawOffer = useWithdrawOffer();

  const prevSelectedIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  useEffect(() => {
    if (!user || !selectedRequests) return;
    const myJobs = selectedRequests.filter((r) => r.selectedDriverId === Number(user.id));
    const currentIds = new Set(myJobs.map((j) => j.id));
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
  const pendingOffers = myOffers?.filter((o) => o.request?.status === "OPEN") ?? [];

  const totalEarnings = mySelectedJobs.reduce((sum, r) => sum + ((r as any).monthlyPrice ?? 0), 0);

  const estimatedMonthlyTrips = mySelectedJobs.reduce((sum, r) => sum + ((r as any).workingDaysPerWeek ?? 5) * WEEKS_PER_MONTH, 0);
  const avgPerTrip = estimatedMonthlyTrips > 0 ? Math.round(totalEarnings / estimatedMonthlyTrips) : 0;

  const earningsStats = [
    { label: "اشتراكات نشطة", value: String(mySelectedJobs.length) },
    { label: "رحلات مكتملة (هذا الشهر)", value: String(estimatedMonthlyTrips) },
    { label: "متوسط الدخل لكل رحلة", value: avgPerTrip > 0 ? `${avgPerTrip} ريال` : "—" },
  ];

  async function confirmWithdraw(offerId: number) {
    setWithdrawConfirmId(null);
    try {
      await withdrawOffer.mutateAsync({ offerId });
      toast({ title: "تم الإلغاء", description: "تم إلغاء قبولك بنجاح" });
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      toast({ title: "خطأ في الإلغاء", description: apiErr?.data?.error ?? "حدث خطأ أثناء الإلغاء", variant: "destructive" });
    }
  }

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "earnings", label: "الأرباح", icon: "💰" },
    { id: "schedule", label: "جدولي", icon: "🗓️", count: mySelectedJobs.length },
    { id: "my-offers", label: "عروضي", icon: "📄", count: myOffers?.length },
    { id: "available", label: "طلبات جديدة", icon: "📋", count: openRequests?.length },
  ];

  return (
    <Layout role="driver">
      <div dir="rtl">
        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-[1.8rem] font-black text-[#0F172A] tracking-tight">لوحة السائق</h1>
          <p className="text-slate-400 font-bold text-sm mt-0.5">إدارة الاشتراكات والعروض</p>
        </div>

        {/* Driver info card */}
        {driver && (
          <div className="rounded-[2rem] p-5 mb-5 shadow-2xl shadow-emerald-900/15" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-black text-xl tracking-tight">{driver.name}</p>
                <p className="text-white/60 text-xs font-bold">سائق توصّلني</p>
              </div>
              <div className={`text-right px-4 py-2 rounded-2xl ${hasEnoughBalance ? "bg-white/20" : "bg-red-400/30"}`}>
                <p className="text-white/70 text-xs font-bold">الرصيد</p>
                <p className="text-white font-black text-lg" dir="ltr">{driver.balance.toFixed(0)} ر.س</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "ريال/شهر", value: totalEarnings > 0 ? (totalEarnings >= 1000 ? `${(totalEarnings / 1000).toFixed(1)}K` : totalEarnings.toFixed(0)) : "—" },
                { label: "نسبة القبول", value: myOffers && myOffers.length > 0 ? `${Math.round((mySelectedJobs.length / myOffers.length) * 100)}%` : "—" },
                { label: "عروض نشطة", value: String(pendingOffers.length) },
                { label: "اشتراكات", value: String(mySelectedJobs.length) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/15 rounded-2xl p-3 text-center">
                  <p className="text-white font-black text-xl leading-tight">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-0.5 leading-tight font-bold">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low balance warning */}
        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-200 rounded-[1.5rem] px-5 py-4 mb-5">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-amber-800 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-700 text-sm mt-0.5 font-bold">
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
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all ${
                activeTab === tab.id ? "text-white shadow-md" : "bg-white text-slate-500 border-2 border-slate-100"
              }`}
              style={activeTab === tab.id ? { background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" } : {}}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs rounded-full px-2 py-0.5 font-black leading-none ${activeTab === tab.id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Available ── */}
        {activeTab === "available" && (
          <>
            {isLoading && <div className="text-center py-20 text-slate-400 font-bold">جاري تحميل الطلبات...</div>}
            {!isLoading && (!openRequests || openRequests.length === 0) && (
              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-xl font-black text-[#0F172A]">لا توجد طلبات مفتوحة</p>
                <p className="text-slate-400 font-bold text-sm mt-1">تحقق لاحقاً لعروض دوام جديدة</p>
              </div>
            )}
            {openRequests && openRequests.length > 0 && (
              <div className="space-y-4">
                {openRequests.map((req) => {
                  const clientTypeLabel = (req as any).clientType || "طلب توصيل";
                  const emoji = CLIENT_TYPE_EMOJI[clientTypeLabel] ?? "📦";
                  const offerCount = (req as any).offerCount ?? 0;
                  return (
                    <div key={req.id} className="rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/60 bg-white">
                      <div className="p-5" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{emoji}</span>
                            <div>
                              <p className="text-white font-black text-lg tracking-tight">{clientTypeLabel}</p>
                              <p className="text-white/60 text-xs font-bold">REQ-{String(req.id).padStart(3, "0")}</p>
                            </div>
                          </div>
                          <div className="bg-white/20 rounded-2xl px-4 py-2 text-center border border-white/30">
                            <p className="text-white font-black text-2xl" dir="ltr">{(req as any).monthlyPrice?.toFixed(0) ?? "—"}</p>
                            <p className="text-white/70 text-xs font-bold">ريال/شهر</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <MapPin size={15} className="text-[#312E81] shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold">من (المنطلق)</p>
                              <p className="text-sm text-slate-700 font-black">{req.homeLocation}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold">إلى (الوصول)</p>
                              <p className="text-sm text-slate-700 font-black">{req.workLocation}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5"><Clock size={12} /></div>
                            <p className="text-xs font-black text-slate-700" dir="ltr">{formatTime12h(req.morningTime)}</p>
                            <p className="text-[10px] text-slate-400 font-bold">الذهاب</p>
                          </div>
                          {req.eveningTime && (
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5"><Clock size={12} /></div>
                              <p className="text-xs font-black text-slate-700" dir="ltr">{formatTime12h(req.eveningTime)}</p>
                              <p className="text-[10px] text-slate-400 font-bold">العودة</p>
                            </div>
                          )}
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5"><Users size={12} /></div>
                            <p className="text-xs font-black text-slate-700">{req.numberOfPeople}</p>
                            <p className="text-[10px] text-slate-400 font-bold">أشخاص</p>
                          </div>
                        </div>

                        <div className="flex gap-1.5 flex-wrap">
                          {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                            <span key={d} className="text-xs px-2.5 py-1 rounded-full font-black bg-indigo-100 text-[#312E81]">
                              {d}
                            </span>
                          ))}
                        </div>

                        {offerCount > 0 && (
                          <div className="flex items-center justify-between text-xs font-black text-slate-500 pt-1 border-t border-slate-100">
                            <span>عدد العروض المقدمة</span>
                            <span className="text-[#312E81]">{offerCount} عروض</span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100">
                          {hasEnoughBalance ? (
                            <Link href={`/driver/request/${req.id}`}>
                              <div className="w-full py-4 rounded-[1.5rem] text-white font-black text-base shadow-xl shadow-emerald-900/25 active:scale-95 transition-transform flex items-center justify-center gap-2"
                                style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
                                قدم عرضك الشهري
                                <ChevronLeft size={16} className="text-white/70" aria-hidden="true" />
                              </div>
                            </Link>
                          ) : (
                            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                              <p className="text-center text-sm font-black text-red-600 mb-2">⚠️ رصيدك غير كافٍ لتقديم عرض</p>
                              <p className="text-center text-xs text-red-400 mb-3">تحتاج 50 ريال كحد أدنى</p>
                              <button
                                onClick={() => setLocation("/driver/profile")}
                                className="w-full py-2.5 rounded-xl font-black text-sm text-white min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}
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

        {/* ── Tab: My Offers ── */}
        {activeTab === "my-offers" && (
          <div className="space-y-4">
            {offersLoading && <div className="text-center py-20 text-slate-400 font-bold">جاري تحميل عروضك...</div>}
            {!offersLoading && (!myOffers || myOffers.length === 0) && (
              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                <FileText size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-xl font-black text-[#0F172A]">لم تقدم أي عرض بعد</p>
                <p className="text-slate-400 font-bold text-sm mt-1">تصفّح الطلبات المتاحة وقدم عرضك</p>
                <button onClick={() => setActiveTab("available")}
                  className="mt-5 px-6 py-3 rounded-full text-sm font-black border-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                  عرض الطلبات المتاحة
                </button>
              </div>
            )}

            {myOffers && myOffers.length > 0 && (
              <div className="space-y-3">
                {myOffers.map((offer) => {
                  const clientType = offer.request?.clientType ?? "";
                  const emoji = CLIENT_TYPE_EMOJI[clientType] ?? "📦";
                  const statusInfo = OFFER_STATUS_LABEL[offer.status] ?? { label: offer.status, className: "bg-slate-100 text-slate-500" };
                  const wasAccepted = offer.status === "SELECTED" || mySelectedJobs.some((j) => j.id === offer.requestId);

                  return (
                    <div key={offer.id} className={`rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/60 bg-white border-2 ${wasAccepted ? "border-emerald-200" : "border-indigo-50"}`}>
                      <div className="px-5 py-4" style={{ background: wasAccepted ? "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" : "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{emoji}</span>
                            <div>
                              <p className="text-white font-black text-base">{clientType || "طلب توصيل"}</p>
                              <p className="text-white/60 text-xs font-bold">
                                REQ-{String(offer.requestId).padStart(3, "0")}
                                {offer.clientName ? ` • ${offer.clientName}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="px-5 py-4 space-y-3">
                        {offer.request && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            <span className="font-bold">{offer.request.homeLocation} ← {offer.request.workLocation}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-2xl p-3 text-center">
                            <p className="text-[#312E81] font-black text-xl">{offer.competitorCount ?? 0}</p>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">عدد المنافسين</p>
                          </div>
                          <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                            <p className="text-emerald-700 font-black text-xl" dir="ltr">
                              {offer.request?.monthlyPrice?.toFixed(0) ?? "—"} <span className="text-sm">ريال</span>
                            </p>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">عرضك الشهري</p>
                          </div>
                        </div>

                        {offer.status === "PENDING" && (
                          <div className="flex items-center justify-end pt-1">
                            {withdrawConfirmId === offer.id ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-slate-700">تأكيد إلغاء العرض؟</span>
                                <button
                                  onClick={() => confirmWithdraw(offer.id)}
                                  disabled={withdrawOffer.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-black hover:bg-red-600 disabled:opacity-50"
                                >
                                  <Check size={13} /> نعم
                                </button>
                                <button
                                  onClick={() => setWithdrawConfirmId(null)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-slate-200 text-xs font-black text-slate-600"
                                >
                                  <X size={13} /> لا
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setWithdrawConfirmId(offer.id)} disabled={withdrawOffer.isPending}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-red-100 text-xs font-black text-red-500 hover:bg-red-50">
                                <Trash2 size={13} /> إلغاء العرض
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mySelectedJobs.length > 0 && (
              <Link href="/driver/requests">
                <div className="w-full py-4 rounded-[1.5rem] text-white font-black text-base shadow-xl shadow-emerald-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2 mt-2"
                  style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
                  عرض الجدول اليومي
                  <ChevronLeft size={16} className="text-white/70" />
                </div>
              </Link>
            )}
          </div>
        )}

        {/* ── Tab: Schedule ── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {mySelectedJobs.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                <p className="text-4xl mb-3">🗓️</p>
                <p className="text-xl font-black text-[#0F172A]">لا توجد اشتراكات نشطة</p>
                <p className="text-slate-400 font-bold text-sm mt-1">ستظهر هنا اشتراكاتك بعد اختيارك من العملاء</p>
              </div>
            )}
            {mySelectedJobs.map((req) => (
              <div key={req.id} className="rounded-[2rem] overflow-hidden shadow-xl shadow-emerald-900/10">
                <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-300" />
                      <span className="text-white font-black text-sm">اشتراك نشط</span>
                    </div>
                    <span className="text-white/60 text-xs font-bold">REQ-{String(req.id).padStart(3, "0")}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white/90 text-sm font-bold">
                      <MapPin size={13} className="text-emerald-300 shrink-0" /> {req.homeLocation}
                    </div>
                    <div className="flex items-center gap-2 text-white/90 text-sm font-bold">
                      <MapPin size={13} className="text-rose-300 shrink-0" /> {req.workLocation}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                      <p className="text-white/70 text-[10px] font-bold">الذهاب</p>
                      <p className="text-white font-black text-sm" dir="ltr">{formatTime12h(req.morningTime)}</p>
                    </div>
                    {req.eveningTime && (
                      <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                        <p className="text-white/70 text-[10px] font-bold">العودة</p>
                        <p className="text-white font-black text-sm" dir="ltr">{formatTime12h(req.eveningTime)}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white px-5 py-4 space-y-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_FULL.slice(0, req.workingDaysPerWeek ?? 5).map((d) => (
                      <span key={d} className="text-xs px-2.5 py-1 rounded-full font-black bg-emerald-100 text-emerald-700">
                        {d}
                      </span>
                    ))}
                  </div>
                  {req.phone && (
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm">
                        {req.selectedDriver?.name?.charAt(0) ?? "ع"}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold">العميل</p>
                        <a href={`tel:${req.phone}`} className="text-sm font-black text-[#0F172A]" dir="ltr">{req.phone}</a>
                      </div>
                      <a href={`tel:${req.phone}`}
                        className="flex items-center gap-1 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border-2 border-emerald-200">
                        <Phone size={13} /> اتصال
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Earnings ── */}
        {activeTab === "earnings" && (
          <div className="space-y-4">
            <div className="rounded-[2rem] p-6 shadow-2xl shadow-emerald-900/15" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
              <p className="text-white/70 font-bold text-sm mb-1">إجمالي الدخل الشهري</p>
              <p className="text-white text-5xl font-black tracking-tight" dir="ltr">
                {totalEarnings.toFixed(0)} <span className="text-2xl opacity-70">ريال</span>
              </p>
            </div>
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden border-2 border-slate-100">
              {earningsStats.map((item, i) => (
                <div key={item.label} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <p className="text-sm text-slate-700 font-black">{item.label}</p>
                  <p className="font-black text-[#312E81] text-xl">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
