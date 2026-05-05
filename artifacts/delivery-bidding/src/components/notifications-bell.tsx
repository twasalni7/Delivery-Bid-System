import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Bell, X, CheckCheck, Package2, Truck, MessageSquare, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN as API } from "@/lib/api-config";
import { executeNotificationAction, type AppNotification } from "@/lib/notification-actions";
import { useAuth } from "@/contexts/auth-context";

function typeIcon(type: string) {
  if (type === "offer")   return <Package2   size={14} className="shrink-0" style={{ color: "var(--brand)" }} />;
  if (type === "request") return <Truck       size={14} className="shrink-0" style={{ color: "var(--status-frozen-text)" }} />;
  if (type === "support") return <MessageSquare size={14} className="shrink-0" style={{ color: "var(--status-active-text)" }} />;
  return <Info size={14} className="shrink-0" style={{ color: "var(--text-muted)" }} />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/notifications`, { headers: getAuthHeaders() });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/notifications/mark-all-read`, { method: "PATCH", headers: getAuthHeaders() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/api/notifications/${id}/read`, { method: "PATCH", headers: getAuthHeaders() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function handleNotificationClick(n: AppNotification) {
    setOpen(false);
    if (n.url || n.actionType === "emit_event") {
      void executeNotificationAction(n, "in_app");
      return;
    }
    if (!n.isRead) markRead.mutate(n.id);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="touch-compact relative p-2 rounded-xl transition-colors"
        title="الإشعارات"
        style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", minHeight: "auto", minWidth: "auto" }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[17px] h-[17px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 shadow-sm"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-11 left-0 z-50 w-80 rounded-2xl overflow-hidden"
          dir="rtl"
          style={{ maxHeight: "420px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-2)" }}>
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: "var(--brand)" }} />
              <span className="font-bold text-sm" style={{ color: "var(--text)" }}>الإشعارات</span>
              {unread > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>
                  {unread} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="touch-compact flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                  style={{ color: "var(--brand)", backgroundColor: "var(--brand-subtle)", minHeight: "auto", minWidth: "auto" }}
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck size={12} /> كل
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="touch-compact p-1 rounded-lg"
                style={{ color: "var(--text-muted)", minHeight: "auto", minWidth: "auto" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "350px" }}>
            {notifications.length === 0 ? (
              <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: !n.isRead ? "var(--brand-subtle)" : "transparent",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: !n.isRead ? "var(--brand-subtle)" : "var(--surface-2)" }}
                  >
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: !n.isRead ? "var(--text)" : "var(--text-sub)" }}>
                        {n.title}
                      </p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: "var(--brand)" }} />}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-hint)" }}>{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {user && (
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--surface-2)" }}>
              <Link href={user.role === "admin" ? "/admin/notifications-center" : user.role === "driver" ? "/driver/notifications" : "/client/notifications"}>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  عرض كل الإشعارات
                </button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
