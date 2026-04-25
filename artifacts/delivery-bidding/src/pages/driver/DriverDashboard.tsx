import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, useListMyOffers, useWithdrawOffer } from "@workspace/api-client-react";
import type { DriverOffer } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle, Phone, FileText, Trash2, X, Check, MessageCircle, Calendar } from "lucide-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { toast } from "@/hooks/use-toast";

type TabId = "available" | "my-offers" | "earnings";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الجم", "الس"];

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  const { data: allRequests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 30_000 } });
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" }, { query: { refetchInterval: 30_000 } });
  const { data: myOffers, isLoading: offersLoading } = useListMyOffers({ query: { enabled: !!user, refetchInterval: 30_000 } });
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
    const myJobs = selectedRequests.filter((r) => r.selectedDriverId === user.id);
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

  if (!user) return null;

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;
  const mySelectedJobs = selectedRequests?.filter((r) => r.selectedDriverId === user.id) ?? [];
  const pendingOffers = myOffers?.filter((o) => o.request?.status === "OPEN") ?? [];
  const closedOffers = myOffers?.filter((o) => o.request?.status !== "OPEN") ?? [];

  const totalEarnings = closedOffers.reduce((sum, o) => {
    if (o.request?.status === "SELECTED" || o.request?.status === "ACTIVE" || o.request?.status === "COMPLETED") {
      return sum + ((o.request as any).monthlyPrice ?? 0);
    }
    return sum;
  }, 0);

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
    { id: "available", label: "طلبات جديدة", icon: "📋", count: openRequests?.length },
    { id: "my-offers", label: "قبولاتي", icon: "📄", count: myOffers?.length },
    { id: "earnings", label: "أرباحي", icon: "💰" },
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
                { label: "الأرباح المتوقعة", value: `${totalEarnings.toFixed(0)}`, unit: "ر.س" },
                { label: "نسبة القبول", value: myOffers && myOffers.length > 0 ? `${Math.round((closedOffers.length / myOffers.length) * 100)}%` : "—" },
                { label: "قبولات نشطة", value: String(pendingOffers.length) },
                { label: "طلبات مفتوحة", value: String(openRequests?.length ?? 0) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/15 rounded-2xl p-3 text-center">
                  <p className="text-white font-black text-xl leading-tight">{stat.value}{stat.unit ? <span className="text-sm"> {stat.unit}</span> : ""}</p>
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

        {/* Selected jobs */}
        {mySelectedJobs.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-black text-[#312E81] mb-3">🎉 تم اختيارك!</p>
            <div className="space-y-3">
              {mySelectedJobs.map((req) => (
                <div key={req.id} className="rounded-[2rem] overflow-hidden shadow-xl shadow-emerald-900/10">
                  <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={18} className="text-white" />
                      <span className="text-white font-black text-sm">تم اختيارك لطلب #{req.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80 text-sm font-bold">
                      <MapPin size={13} /> {req.homeLocation} ← {req.workLocation}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80 text-sm font-bold mt-1" dir="ltr">
                      <Clock size={13} /> {formatTime12h(req.morningTime)}
                    </div>
                  </div>
                  {req.phone && (
                    <div className="bg-white px-4 py-3 flex items-center gap-3">
                      <Phone size={15} className="text-emerald-600" />
                      <a href={`tel:${req.phone}`} className="text-sm font-black text-[#0F172A]" dir="ltr">{req.phone}</a>
                      <a
                        href={`https://wa.me/${req.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mr-auto bg-emerald-500 text-white text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1.5"
                      >
                        <MessageCircle size={13} /> واتساب
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                {openRequests.map((req) => (
                  <div key={req.id} className="rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/60 bg-white">
                    <div className="p-5" style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black bg-white/25 text-white px-3 py-1 rounded-full uppercase tracking-widest">
                          {getStatusLabel(req.status)}
                        </span>
                        <span className="text-white/60 text-xs font-bold">طلب #{req.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl">
                            {(req as any).clientType === "موظفات" ? "👩‍💼" :
                             (req as any).clientType === "طلاب" ? "🎓" :
                             (req as any).clientType === "مدارس" ? "🏫" : "📦"}
                          </span>
                          <div>
                            <p className="text-white font-black text-lg tracking-tight">{(req as any).clientType || "طلب توصيل"}</p>
                            <p className="text-white/60 text-xs font-bold">{req.numberOfPeople} ركاب</p>
                          </div>
                        </div>
                        <div className="bg-white/15 rounded-2xl px-4 py-2 text-center">
                          <p className="text-white/70 text-[10px] font-black uppercase">شهري</p>
                          <p className="text-white font-black text-xl" dir="ltr">{(req as any).monthlyPrice?.toFixed(0) ?? "—"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="space-y-3 relative pr-4">
                        <div className="absolute right-[7px] top-3 bottom-3 w-[3px] bg-slate-100 rounded-full" />
                        <div className="flex items-start gap-4 relative z-10">
                          <div className="w-5 h-5 rounded-full bg-[#312E81] border-4 border-white shadow-sm mt-0.5 shrink-0" />
                          <p className="text-sm text-slate-700 font-black">{req.homeLocation}</p>
                        </div>
                        <div className="flex items-start gap-4 relative z-10">
                          <div className="w-5 h-5 rounded-full bg-rose-500 border-4 border-white shadow-sm mt-0.5 shrink-0" />
                          <p className="text-sm text-slate-700 font-black">{req.workLocation}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          <span dir="ltr" className="font-black">{formatTime12h(req.morningTime)}</span>
                          {req.eveningTime && <span dir="ltr" className="font-black"> – {formatTime12h(req.eveningTime)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="font-black">{req.workingDaysPerWeek} أيام/أسبوع</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS_AR.map((d, i) => {
                          const active = i < (req.workingDaysPerWeek ?? 5);
                          return (
                            <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-black ${active ? "bg-indigo-100 text-[#312E81]" : "bg-slate-100 text-slate-400"}`}>
                              {d}
                            </span>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        {hasEnoughBalance ? (
                          <Link href={`/driver/request/${req.id}`}>
                            <div className="w-full py-3.5 rounded-[1.5rem] text-white font-black text-sm shadow-xl shadow-indigo-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                              style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
                              عرض التفاصيل وتقديم قبول
                            </div>
                          </Link>
                        ) : (
                          <p className="text-center text-sm font-black text-red-500">رصيد غير كافٍ للقبول</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                <p className="text-xl font-black text-[#0F172A]">لم تقبل أي طلب بعد</p>
                <p className="text-slate-400 font-bold text-sm mt-1">تصفّح الطلبات المتاحة واقبل ما يناسبك</p>
                <button onClick={() => setActiveTab("available")}
                  className="mt-5 px-6 py-3 rounded-full text-sm font-black border-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                  عرض الطلبات المتاحة
                </button>
              </div>
            )}

            {pendingOffers.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">قبولات قيد الانتظار</p>
                <div className="space-y-3">
                  {pendingOffers.map((offer) => (
                    <div key={offer.id} className="rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/60 bg-white border-2 border-indigo-50">
                      <div className="px-5 py-3 border-b border-indigo-50" style={{ background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)" }}>
                        <p className="text-sm text-[#312E81] font-black">طلب #{offer.requestId}</p>
                      </div>
                      <div className="p-5">
                        {offer.request && (
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <MapPin size={14} className="shrink-0 text-[#312E81]" />
                              <span className="font-black">{offer.request.homeLocation} ← {offer.request.workLocation}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-bold" dir="ltr">
                              <span className="flex items-center gap-1"><Clock size={12} />{formatTime12h(offer.request.morningTime)}{offer.request.eveningTime ? ` – ${formatTime12h(offer.request.eveningTime)}` : ""}</span>
                              <span className="flex items-center gap-1"><Users size={12} />{offer.request.numberOfPeople} أشخاص · {offer.request.workingDaysPerWeek} أيام</span>
                            </div>
                            <p className="text-lg font-black text-emerald-600" dir="ltr">
                              {offer.request.monthlyPrice?.toFixed(0) ?? "—"} <span className="text-sm font-bold text-slate-400">ر.س/شهر</span>
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-end">
                          {withdrawConfirmId === offer.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-700">تأكيد إلغاء القبول؟</span>
                              <button
                                onClick={() => confirmWithdraw(offer.id)}
                                disabled={withdrawOffer.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-black hover:bg-red-600 disabled:opacity-50"
                              >
                                <Check size={13} /> نعم، إلغاء
                              </button>
                              <button
                                onClick={() => setWithdrawConfirmId(null)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50"
                              >
                                <X size={13} /> لا
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setWithdrawConfirmId(offer.id)} disabled={withdrawOffer.isPending}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-red-100 text-xs font-black text-red-500 hover:bg-red-50">
                              <Trash2 size={13} /> إلغاء القبول
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {closedOffers.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">قبولات سابقة</p>
                <div className="space-y-3">
                  {closedOffers.map((offer) => {
                    const wasAccepted = mySelectedJobs.some((j) => j.id === offer.requestId);
                    return (
                      <div key={offer.id} className={`rounded-[2rem] shadow-sm p-4 ${wasAccepted ? "bg-emerald-50 border-2 border-emerald-300" : "bg-white border-2 border-slate-100 opacity-80"}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs text-slate-400 font-bold">طلب #{offer.requestId}</p>
                              {wasAccepted ? (
                                <span className="flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-white">
                                  <CheckCircle size={11} /> تم اختيارك
                                </span>
                              ) : (
                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                  offer.request?.status === "SELECTED" ? "bg-slate-100 text-slate-500" :
                                  offer.request?.status === "ACTIVE" ? "bg-indigo-100 text-[#312E81]" :
                                  "bg-slate-100 text-slate-500"
                                }`}>
                                  {getStatusLabel(offer.request?.status ?? "")}
                                </span>
                              )}
                            </div>
                            {offer.request && (
                              <p className={`text-sm font-black ${wasAccepted ? "text-emerald-800" : "text-slate-600"}`}>{offer.request.homeLocation} ← {offer.request.workLocation}</p>
                            )}
                            <p className={`text-base font-black mt-1 ${wasAccepted ? "text-emerald-700" : "text-slate-800"}`} dir="ltr">{offer.request?.monthlyPrice?.toFixed(0) ?? "—"} ر.س/شهر</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Earnings ── */}
        {activeTab === "earnings" && (
          <div className="space-y-4">
            <div className="rounded-[2rem] p-6 shadow-2xl shadow-emerald-900/15" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
              <p className="text-white/70 font-bold text-sm mb-1">إجمالي الدخل المتوقع</p>
              <p className="text-white text-5xl font-black tracking-tight" dir="ltr">
                {totalEarnings.toFixed(0)} <span className="text-2xl opacity-70">ريال</span>
              </p>
            </div>
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden border-2 border-slate-100">
              {[
                { label: "اشتراكات نشطة", value: mySelectedJobs.length },
                { label: "عروض قيد الانتظار", value: pendingOffers.length },
                { label: "عروض سابقة", value: closedOffers.length },
                { label: "إجمالي العروض المقدّمة", value: myOffers?.length ?? 0 },
              ].map((item, i) => (
                <div key={item.label} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <p className="text-sm text-slate-700 font-black">{item.label}</p>
                  <p className="text-2xl font-black text-[#312E81]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
