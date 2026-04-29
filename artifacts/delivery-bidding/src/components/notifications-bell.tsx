import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, Package2, Truck, MessageSquare, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { API_ORIGIN as API } from "@/lib/api-config";

type Notification = {
  id: number;
  userId: number;
  userRole: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedId: number | null;
  createdAt: string;
};

function typeIcon(type: string) {
  if (type === "offer") return <Package2 size={14} className="shrink-0" style={{ color: "#deff9a" }} />;
  if (type === "request") return <Truck size={14} className="shrink-0" style={{ color: "#60a5fa" }} />;
  if (type === "support") return <MessageSquare size={14} className="shrink-0" style={{ color: "#34d399" }} />;
  return <Info size={14} className="shrink-0" style={{ color: "rgba(255,255,255,0.45)" }} />;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/notifications`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/api/notifications/mark-all-read`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
        title="الإشعارات"
      >
        <Bell size={18} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1 shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-12 left-0 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden"
          dir="rtl"
          style={{ maxHeight: "420px", backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#161616" }}>
            <div className="flex items-center gap-2">
              <Bell size={15} style={{ color: "#deff9a" }} />
              <span className="font-black text-white text-sm">الإشعارات</span>
              {unread > 0 && (
                <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}>{unread} جديد</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors"
                  style={{ color: "#deff9a", backgroundColor: "rgba(222,255,154,0.08)" }}
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck size={13} /> كل
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <X size={14} style={{ color: "rgba(255,255,255,0.45)" }} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "350px" }}>
            {notifications.length === 0 ? (
              <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    backgroundColor: !n.isRead ? "rgba(222,255,154,0.05)" : "transparent",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: !n.isRead ? "rgba(222,255,154,0.08)" : "rgba(255,255,255,0.05)" }}
                  >
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold leading-tight" style={{ color: !n.isRead ? "#ffffff" : "rgba(255,255,255,0.72)" }}>
                        {n.title}
                      </p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: "#deff9a" }} />}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.55)" }}>{n.message}</p>
                    <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
