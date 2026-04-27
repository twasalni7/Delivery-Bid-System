import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useListRequests, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { Bell, MapPin, Clock, Users, Calendar } from "lucide-react";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼", طلاب: "🎓", مدارس: "🏫", جامعات: "🎓", معلمات: "📚", غيره: "📦",
};

const STATUS_GRADIENT: Record<string, string> = {
  OPEN:      "linear-gradient(135deg, #312E81 0%, #4338CA 100%)",
  SELECTED:  "linear-gradient(135deg, #065F46 0%, #059669 100%)",
  ACTIVE:    "linear-gradient(135deg, #065F46 0%, #059669 100%)",
  COMPLETED: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
  CANCELLED: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  EXPIRED:   "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
  FROZEN:    "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
};

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الجم", "الس"];

export default function ClientDashboard() {
  const { data: requests, isLoading } = useListRequests(undefined, {
    query: { queryKey: getListRequestsQueryKey(), refetchInterval: 20_000 },
  });

  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!requests) return;
    const map: Record<number, number> = {};
    for (const req of requests) {
      if (req.status !== "OPEN") continue;
      const currentCount = req.offerCount ?? 0;
      const seenCount = parseInt(localStorage.getItem(SEEN_KEY(req.id)) ?? "0", 10);
      const unread = Math.max(0, currentCount - seenCount);
      if (unread > 0) map[req.id] = unread;
    }
    setUnreadMap(map);
  }, [requests]);

  const totalUnread = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

  return (
    <Layout role="client">
      <div dir="rtl">
        {/* Page title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[1.8rem] font-black text-[#0F172A] tracking-tight">اشتراكاتي</h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center gap-1 bg-[#312E81] text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                  <Bell size={12} /> {totalUnread}
                </span>
              )}
            </div>
            <p className="text-slate-400 font-bold text-sm mt-0.5">اشتراكات التوصيل الشهري</p>
          </div>
        </div>

        {/* CTA button */}
        <Link href="/client/request/new">
          <div className="w-full mb-6 rounded-[1.5rem] py-4 px-5 flex items-center justify-center gap-2.5 font-black text-white text-base shadow-xl shadow-indigo-900/20 active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
            <span className="text-2xl leading-none">+</span>
            اشتراك شهري جديد
          </div>
        </Link>

        {isLoading && (
          <div className="text-center py-20 text-slate-400 font-bold text-base">جاري التحميل...</div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-xl font-black text-[#0F172A]">لا توجد اشتراكات بعد</p>
            <p className="text-slate-400 font-bold text-sm mt-1">أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
          </div>
        )}

        {requests && requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((req) => {
              const offerCount = req.offerCount ?? 0;
              const unread = unreadMap[req.id] ?? 0;
              const gradient = STATUS_GRADIENT[req.status] ?? STATUS_GRADIENT.OPEN;
              const emoji = CLIENT_TYPE_EMOJI[(req as any).clientType ?? ""] ?? "📦";
              const clientTypeLabel = (req as any).clientType ?? "";

              return (
                <Link key={req.id} href={`/client/request/${req.id}`}>
                  <div className={`rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/60 active:scale-[0.99] transition-transform ${unread > 0 ? "ring-2 ring-[#312E81]" : ""}`}>
                    {/* Gradient header */}
                    <div className="p-5 text-white" style={{ background: gradient }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-black bg-white/25 px-3 py-1 rounded-full uppercase tracking-widest">
                            {getStatusLabel(req.status)}
                          </span>
                          {unread > 0 && (
                            <span className="text-xs font-black bg-white text-[#312E81] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Bell size={11} /> {unread} جديد
                            </span>
                          )}
                        </div>
                        {offerCount > 0 && (
                          <p className="text-white/80 text-sm font-black">{offerCount} {offerCount === 1 ? "عرض" : "عروض"}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-4xl">{emoji}</span>
                        <div>
                          {clientTypeLabel && <p className="text-white font-black text-xl tracking-tight">{clientTypeLabel}</p>}
                          <p className="text-white/60 text-xs font-bold">طلب #{req.id}</p>
                        </div>
                      </div>
                    </div>

                    {/* White body */}
                    <div className="bg-white px-5 py-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <MapPin size={16} className="text-[#312E81] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-400 font-bold mb-0.5">من (الانطلاق)</p>
                          <p className="text-sm text-[#0F172A] font-black">{req.homeLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-400 font-bold mb-0.5">إلى (الوصول)</p>
                          <p className="text-sm text-[#0F172A] font-black">{req.workLocation}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-700 font-black" dir="ltr">{formatTime12h(req.morningTime)}</span>
                        </div>
                        {req.eveningTime && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-700 font-black" dir="ltr">{formatTime12h(req.eveningTime)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-700 font-black">{req.numberOfPeople} ركاب</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-700 font-black">{req.workingDaysPerWeek} أيام/أسبوع</span>
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

                      {req.selectedDriver && (
                        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-black text-emerald-700">
                            {req.selectedDriver.name?.charAt(0) ?? "س"}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-400 font-bold">السائق</p>
                            <p className="text-sm font-black text-[#0F172A]">{req.selectedDriver.name}</p>
                          </div>
                          {req.selectedDriver.mobile && (
                            <a href={`tel:${req.selectedDriver.mobile}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border-2 border-emerald-200">
                              اتصال
                            </a>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-center pt-2 border-t border-slate-100">
                        <span className="text-[#312E81] text-sm font-black">
                          {req.status === "SELECTED" || req.status === "ACTIVE"
                            ? "عرض تفاصيل الرحلات اليومية ‹"
                            : "عرض تفاصيل العروض ‹"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
