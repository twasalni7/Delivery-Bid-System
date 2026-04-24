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
  if (type === "offer") return <Package2 size={14} className="text-violet-500 shrink-0" />;
  if (type === "request") return <Truck size={14} className="text-blue-500 shrink-0" />;
  if (type === "support") return <MessageSquare size={14} className="text-green-500 shrink-0" />;
  return <Info size={14} className="text-gray-400 shrink-0" />;
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
          className="absolute top-12 left-0 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          dir="rtl"
          style={{ maxHeight: "420px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-violet-600" />
              <span className="font-black text-gray-800 text-sm">الإشعارات</span>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-full">{unread} جديد</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck size={13} /> كل
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "350px" }}>
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? "bg-violet-50/50" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${!n.isRead ? "bg-violet-100" : "bg-gray-100"}`}>
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-bold leading-tight ${!n.isRead ? "text-gray-900" : "text-gray-600"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
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
