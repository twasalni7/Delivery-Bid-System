import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useListRequests, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { Bell } from "lucide-react";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼",
  طلاب: "🎓",
  مدارس: "🏫",
  جامعات: "🎓",
  معلمات: "📚",
  غيره: "📦",
};

const STATUS_GRADIENT: Record<string, string> = {
  OPEN:      "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  BIDDING:   "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  SELECTED:  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  ACTIVE:    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  COMPLETED: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
  CANCELLED: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  EXPIRED:   "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
  FROZEN:    "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
};

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

export default function ClientDashboard() {
  const { data: requests, isLoading } = useListRequests(undefined, {
    query: { queryKey: getListRequestsQueryKey() },
  });

  const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!requests) return;
    const map: Record<number, number> = {};
    for (const req of requests) {
      if (req.status !== "OPEN" && req.status !== "BIDDING") continue;
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900">اشتراكاتي</h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  <Bell size={10} />
                  {totalUnread}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5">توصّل شهري</p>
          </div>
        </div>

        <Link href="/client/request/new">
          <div className="w-full mb-5 rounded-2xl py-3.5 px-5 flex items-center justify-center gap-2 font-bold text-white shadow-md active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
            <span className="text-xl leading-none">+</span>
            إضافة اشتراك شهري جديد
          </div>
        </Link>

        {isLoading && (
          <div className="text-center py-16 text-gray-400 text-sm">جاري التحميل...</div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-lg font-bold text-gray-700">لا توجد اشتراكات بعد</p>
            <p className="text-gray-400 text-sm mt-1">أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
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
                    <div className="p-4 text-white" style={{ background: gradient }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                            {getStatusLabel(req.status)}
                          </span>
                          {unread > 0 && (
                            <span className="text-xs font-bold bg-white text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Bell size={9} /> {unread} جديد
                            </span>
                          )}
                        </div>
                        <div className="text-left">
                          {offerCount > 0 && (
                            <p className="text-white/80 text-xs">{offerCount} {offerCount === 1 ? "عرض" : "عروض"}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-3xl">{emoji}</span>
                        <div>
                          {clientTypeLabel && (
                            <p className="text-white font-bold">{clientTypeLabel}</p>
                          )}
                          <p className="text-white/70 text-xs">#{req.id}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white px-4 py-3 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500 text-sm mt-0.5">📍</span>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400">من (الانطلاق)</p>
                          <p className="text-sm text-gray-800 font-medium">{req.homeLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 text-sm mt-0.5">📍</span>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400">إلى (الوصول)</p>
                          <p className="text-sm text-gray-800 font-medium">{req.workLocation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">⏰</span>
                          <span className="text-sm text-gray-700 font-medium" dir="ltr">{formatTime12h(req.morningTime)}</span>
                        </div>
                        {req.eveningTime && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">⏰</span>
                            <span className="text-sm text-gray-700 font-medium" dir="ltr">{formatTime12h(req.eveningTime)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <span>👥</span>
                          <span>{req.numberOfPeople}</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS_AR.map((d, i) => {
                          const active = i < (req.workingDaysPerWeek ?? 5);
                          return (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                              {d}
                            </span>
                          );
                        })}
                      </div>

                      {req.selectedDriver && (
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                            {req.selectedDriver.name?.charAt(0) ?? "س"}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">السائق</p>
                            <p className="text-sm font-bold text-gray-800">{req.selectedDriver.name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-center pt-1 border-t border-gray-100">
                        <span className="text-blue-600 text-xs font-bold">عرض تفاصيل العروض ‹</span>
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
