import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useListRequests, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { EnablePushButton } from "@/components/enable-push-button";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";
import { Bell, MapPin, Clock, Users, Calendar } from "lucide-react";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼", طلاب: "🎓", مدارس: "🏫", جامعات: "🎓", معلمات: "📚", غيره: "📦",
};

const STATUS_GRADIENT: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:      { bg: "var(--status-open-bg)",      border: "var(--status-open-border)",      text: "var(--status-open-text)" },
  SELECTED:  { bg: "var(--status-selected-bg)",  border: "var(--status-selected-border)",  text: "var(--status-selected-text)" },
  ACTIVE:    { bg: "var(--status-active-bg)",    border: "var(--status-active-border)",    text: "var(--status-active-text)" },
  COMPLETED: { bg: "var(--status-completed-bg)", border: "var(--status-completed-border)", text: "var(--status-completed-text)" },
  CANCELLED: { bg: "var(--status-cancelled-bg)", border: "var(--status-cancelled-border)", text: "var(--status-cancelled-text)" },
  EXPIRED:   { bg: "var(--status-expired-bg)",   border: "var(--status-expired-border)",   text: "var(--status-expired-text)" },
  FROZEN:    { bg: "var(--status-frozen-bg)",    border: "var(--status-frozen-border)",    text: "var(--status-frozen-text)" },
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
        <div className="flex items-center justify-between mb-7">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[1.9rem] font-black tracking-tight" style={{ color: "var(--text)" }}>اشتراكاتي</h1>
              {totalUnread > 0 && (
                <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
                  <Bell size={12} /> {totalUnread}
                </span>
              )}
            </div>
            <p className="font-bold text-sm mt-1" style={{ color: "var(--text-muted)" }}>اشتراكات التوصيل الشهري</p>
          </div>
        </div>

        {/* CTA button */}
        <Link href="/client/request/new">
          <div className="w-full mb-7 btn-primary">
            <span className="text-2xl leading-none">+</span>
            اشتراك شهري جديد
          </div>
        </Link>

        {/* Push notifications opt-in */}
        <div className="mb-5">
          <EnablePushButton />
        </div>

        {isLoading && (
          <div className="text-center py-20 font-bold text-base" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-24 rounded-3xl" style={{ backgroundColor: "var(--surface)", border: "2px dashed var(--border-subtle)" }}>
            <p className="text-5xl mb-4">📦</p>
            <p className="text-xl font-black" style={{ color: "var(--text)" }}>لا توجد اشتراكات بعد</p>
            <p className="font-bold text-sm mt-1" style={{ color: "var(--text-hint)" }}>أضف أول طلب دوام شهري للحصول على عروض السائقين</p>
          </div>
        )}

        {requests && requests.length > 0 && (
          <div className="space-y-5">
            {requests.map((req) => {
              const offerCount = req.offerCount ?? 0;
              const unread = unreadMap[req.id] ?? 0;
              const statusStyle = STATUS_GRADIENT[req.status] ?? STATUS_GRADIENT.OPEN;
              const emoji = CLIENT_TYPE_EMOJI[(req as any).clientType ?? ""] ?? "📦";
              const clientTypeLabel = (req as any).clientType ?? "";

              return (
                <Link key={req.id} href={`/client/request/${req.id}`}>
                  <div className="rounded-3xl overflow-hidden active:scale-[0.99] transition-transform"
                    style={{ backgroundColor: "var(--surface)", border: `1px solid ${unread > 0 ? "var(--brand-border)" : "var(--border-subtle)"}` }}>
                    {/* Status header */}
                    <div className="p-5" style={{ backgroundColor: statusStyle.bg, borderBottom: `1px solid ${statusStyle.border}` }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-black px-3 py-1 rounded-full"
                            style={{ backgroundColor: statusStyle.border, color: statusStyle.text }}>
                            {getStatusLabel(req.status)}
                          </span>
                          {unread > 0 && (
                            <span className="text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1"
                              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
                              <Bell size={11} /> {unread} جديد
                            </span>
                          )}
                        </div>
                        {offerCount > 0 && (
                          <p className="text-sm font-black" style={{ color: statusStyle.text }}>{offerCount} {offerCount === 1 ? "عرض" : "عروض"}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-4xl">{emoji}</span>
                        <div>
                          {clientTypeLabel && <p className="font-black text-xl tracking-tight" style={{ color: "var(--text)" }}>{clientTypeLabel}</p>}
                          <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>طلب #{req.id}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                        <div className="flex-1">
                          <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-hint)" }}>من (الانطلاق)</p>
                          <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.homeLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: "#f87171" }} />
                        <div className="flex-1">
                          <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-hint)" }}>إلى (الوصول)</p>
                          <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.workLocation}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} style={{ color: "var(--text-hint)" }} />
                          <span className="text-sm font-black" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12h(req.morningTime)}</span>
                        </div>
                        {req.eveningTime && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} style={{ color: "var(--text-hint)" }} />
                            <span className="text-sm font-black" dir="ltr" style={{ color: "var(--text)" }}>{formatTime12h(req.eveningTime)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users size={14} style={{ color: "var(--text-hint)" }} />
                          <span className="text-sm font-black" style={{ color: "var(--text)" }}>{req.numberOfPeople} ركاب</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} style={{ color: "var(--text-hint)" }} />
                          <span className="text-sm font-black" style={{ color: "var(--text)" }}>{req.workingDaysPerWeek} أيام/أسبوع</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS_AR.map((d, i) => {
                          const active = i < (req.workingDaysPerWeek ?? 5);
                          return (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-black"
                              style={active
                                ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                                : { backgroundColor: "var(--border-subtle)", color: "var(--text-hint)" }}>
                              {d}
                            </span>
                          );
                        })}
                      </div>

                      {req.selectedDriver && (
                        <div className="flex items-center gap-2.5 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                            style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                            {req.selectedDriver.name?.charAt(0) ?? "س"}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>السائق</p>
                            <p className="text-sm font-black" style={{ color: "var(--text)" }}>{req.selectedDriver.name}</p>
                          </div>
                          {req.selectedDriver.mobile && (
                            <a href={`tel:${req.selectedDriver.mobile}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black"
                              style={{ backgroundColor: "#25D366", color: "#fff" }}>
                              اتصال
                            </a>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-center pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <span className="text-sm font-black" style={{ color: "var(--brand)" }}>
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
