import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronLeft, Filter, Info, MessageSquare, Package2, Truck } from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { executeNotificationAction, type AppNotification } from "@/lib/notification-actions";

function typeIcon(type: string) {
  if (type === "offer") return <Package2 size={16} style={{ color: "var(--brand)" }} />;
  if (type === "request") return <Truck size={16} style={{ color: "var(--status-frozen-text)" }} />;
  if (type === "support") return <MessageSquare size={16} style={{ color: "var(--status-active-text)" }} />;
  return <Info size={16} style={{ color: "var(--text-muted)" }} />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function homePath(role: "client" | "driver" | "admin") {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver/dashboard";
  return "/client";
}

export default function NotificationsCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ["notifications", "center"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/notifications?limit=200`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل جلب الإشعارات");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/notifications/mark-all-read`, { method: "PATCH", headers: getAuthHeaders() });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((notification) => !notification.isRead);
    return notifications;
  }, [filter, notifications]);

  if (!user) return null;

  return (
    <Layout role={user.role}>
      <div dir="rtl" className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>مركز الإشعارات</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              جميع إشعاراتك داخل التطبيق مع حالة القراءة والتفاعل
            </p>
          </div>
          <Link href={homePath(user.role)}>
            <button
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <ChevronLeft size={14} className="inline ml-1" />
              رجوع
            </button>
          </Link>
        </div>

        <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Filter size={14} />
            <button
              onClick={() => setFilter("all")}
              className="px-3 py-1.5 rounded-full font-bold"
              style={filter === "all" ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className="px-3 py-1.5 rounded-full font-bold"
              style={filter === "unread" ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              غير المقروء ({notifications.filter((notification) => !notification.isRead).length})
            </button>
          </div>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || notifications.every((notification) => notification.isRead)}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
          >
            <CheckCheck size={14} className="inline ml-1" />
            تحديد الكل كمقروء
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>جاري تحميل الإشعارات...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ backgroundColor: "var(--surface)", border: "1px dashed var(--border)" }}>
            <Bell size={34} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold" style={{ color: "var(--text-muted)" }}>
              {filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات حتى الآن"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => void executeNotificationAction(notification, "in_app")}
                className="w-full text-right rounded-2xl p-4 transition-colors"
                style={{
                  backgroundColor: notification.isRead ? "var(--surface)" : "var(--brand-subtle)",
                  border: `1px solid ${notification.isRead ? "var(--border)" : "var(--brand-border)"}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--surface-2)" }}>
                    {typeIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-black text-base" style={{ color: "var(--text)" }}>{notification.title}</h2>
                        <p className="text-sm mt-1 leading-6" style={{ color: "var(--text-muted)" }}>{notification.message}</p>
                      </div>
                      {!notification.isRead && <span className="w-2.5 h-2.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: "var(--brand)" }} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs" style={{ color: "var(--text-hint)" }}>
                      <span>{timeAgo(notification.createdAt)}</span>
                      <span>•</span>
                      <span>{notification.isRead ? "مقروء" : "غير مقروء"}</span>
                      {notification.interactedAt && (
                        <>
                          <span>•</span>
                          <span>تم التفاعل</span>
                        </>
                      )}
                    </div>
                    {(notification.actionLabel || notification.url) && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "var(--surface-2)", color: "var(--brand)" }}>
                        {notification.actionLabel ?? "فتح الإشعار"}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
