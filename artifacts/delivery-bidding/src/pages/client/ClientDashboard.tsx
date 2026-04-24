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
  OPEN:      "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  SELECTED:  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  ACTIVE:    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  COMPLETED: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
  CANCELLED: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  EXPIRED:   "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
  FROZEN:    "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
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
              <h1 className="text-3xl font-black text-gray-900">اشتراكاتي</h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                  <Bell size={12} /> {totalUnread}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-base mt-0.5">توصّل شهري</p>
          </div>
        </div>

        {/* CTA button */}
        <Link href="/client/request/new">
          <div className="w-full mb-6 rounded-2xl py-4 px-5 flex items-center justify-center gap-2.5 font-black text-white text-lg shadow-lg active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
            <span className="text-2xl leading-none">+</span>
            إضافة اشتراك شهري جديد
          </div>
        </Link>

        {isLoading && (
          <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-xl font-bold text-gray-700">لا توجد اشتراكات بعد</p>
            <p className="text-gray-400 text-base mt-1">أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
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
                  <div className={`rounded-2xl overflow-hidden shadow-md active:scale-[0.99] transition-transform ${unread > 0 ? "ring-2 ring-blue-400" : ""}`}>
                    {/* Gradient header */}
                    <div className="p-5 text-white" style={{ background: gradient }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-bold bg-white/25 px-3 py-1 rounded-full">
                            {getStatusLabel(req.status)}
                          </span>
                          {unread > 0 && (
                            <span className="text-sm font-bold bg-white text-blue-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Bell size={11} /> {unread} جديد
                            </span>
                          )}
                        </div>
                        {offerCount > 0 && (
                          <p className="text-white/80 text-sm font-bold">{offerCount} {offerCount === 1 ? "عرض" : "عروض"}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-4xl">{emoji}</span>
                        <div>
                          {clientTypeLabel && <p className="text-white font-black text-lg">{clientTypeLabel}</p>}
                          <p className="text-white/65 text-sm">طلب #{req.id}</p>
                        </div>
                      </div>
                    </div>

                    {/* White body */}
                    <div className="bg-white px-5 py-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <MapPin size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-0.5">من (الانطلاق)</p>
                          <p className="text-base text-gray-800 font-bold">{req.homeLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MapPin size={16} className="text-green-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-0.5">إلى (الوصول)</p>
                          <p className="text-base text-gray-800 font-bold">{req.workLocation}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} className="text-gray-400" />
                          <span className="text-base text-gray-700 font-bold" dir="ltr">{formatTime12h(req.morningTime)}</span>
                        </div>
                        {req.eveningTime && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={15} className="text-gray-400" />
                            <span className="text-base text-gray-700 font-bold" dir="ltr">{formatTime12h(req.eveningTime)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users size={15} className="text-gray-400" />
                          <span className="text-base text-gray-700 font-bold">{req.numberOfPeople}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={15} className="text-gray-400" />
                          <span className="text-base text-gray-700 font-bold">{req.workingDaysPerWeek} أيام</span>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {DAYS_AR.map((d, i) => {
                          const active = i < (req.workingDaysPerWeek ?? 5);
                          return (
                            <span key={i} className={`text-sm px-3 py-1 rounded-full font-bold ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                              {d}
                            </span>
                          );
                        })}
                      </div>

                      {req.selectedDriver && (
                        <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-base font-black text-green-700">
                            {req.selectedDriver.name?.charAt(0) ?? "س"}
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">السائق المختار</p>
                            <p className="text-base font-black text-gray-800">{req.selectedDriver.name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-center pt-2 border-t border-gray-100">
                        <span className="text-blue-600 text-base font-bold">عرض تفاصيل العروض ‹</span>
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
