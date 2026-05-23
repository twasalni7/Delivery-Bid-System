import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getStatusLabel } from "@/lib/status-utils";
import { hasArchivedTimestamp } from "@/lib/request-archive-utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Archive, Bell, Plus } from "lucide-react";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

type ClientRequest = {
  id: number;
  status: string;
  homeLocation: string;
  workLocation: string;
  archivedAt?: string | null;
  selectedDriver?: { name?: string | null } | null;
};

export default function ClientDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [...getListRequestsQueryKey(), "active"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/requests?archived=false`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<ClientRequest[]>;
    },
    refetchInterval: 15_000,
  });

  useRealtimeRefresh(
    "client-dashboard-realtime",
    [
      { table: "requests", events: ["UPDATE"] },
      { table: "offers", events: ["INSERT"] },
    ],
    [[...getListRequestsQueryKey(), "active"]]
  );

  const archiveRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/api/requests/${id}/archive`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "تعذرت أرشفة الطلب");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...getListRequestsQueryKey(), "active"] });
      toast({ title: "تمت أرشفة الطلب" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const requests = (Array.isArray(data) ? data : []).filter((req) => !hasArchivedTimestamp(req));
  const displayName = user?.name?.trim() || "عميل";
  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <Layout role="client">
      <div dir="rtl" className="space-y-5">
        <section
          className="rounded-[2rem] p-5"
          style={{
            background: "linear-gradient(160deg, rgba(21,27,45,0.92) 0%, rgba(10,14,26,0.98) 100%)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>مرحباً بك</p>
                <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>{firstName}</h1>
              </div>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-base font-black"
                style={{
                  backgroundColor: "var(--brand-subtle)",
                  color: "var(--brand)",
                  border: "1px solid var(--brand-border)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                {displayName.charAt(0)}
              </div>
            </div>
            <Link
              href="/client/notifications"
              className="touch-compact w-10 h-10 rounded-full flex items-center justify-center"
              style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--surface)", color: "var(--text-sub)" }}
              aria-label="الإشعارات"
            >
              <Bell size={17} />
            </Link>
          </div>
        </section>

        <section
          className="rounded-[2.5rem] p-8 space-y-5"
          aria-label="قسم إنشاء طلب توصيل جديد"
          style={{
            background: "linear-gradient(145deg, rgba(0,230,118,0.22) 0%, rgba(21,27,45,0.92) 55%, rgba(10,14,26,0.98) 100%)",
            color: "var(--text)",
            border: "1px solid var(--brand-border)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="space-y-2">
            <h2 className="text-4xl font-black leading-tight">طلب اشتراك جديد</h2>
            <p className="text-base font-bold" style={{ color: "var(--text-muted)" }}>حدد تفاصيل اشتراكك بخطوات بسيطة</p>
          </div>
          <Link
            href="/client/request/new"
            className="w-full rounded-[1.5rem] px-6 py-5 flex items-center justify-center gap-3 text-lg font-black transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "var(--brand-shadow)", minHeight: "64px" }}
          >
            <Plus size={24} strokeWidth={3} /> ابدأ الآن
          </Link>
          <p className="text-sm font-bold text-center" style={{ color: "var(--text-hint)" }}>💳 الدفع آخر الشهر - بدون دفع مقدم</p>
        </section>



        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black" style={{ color: "var(--text)" }}>طلباتي</h3>
            <Link href="/client/archive" className="text-sm font-black" style={{ color: "var(--brand)" }}>
              الأرشيف
            </Link>
          </div>

          {isLoading && <div className="rounded-2xl p-5 text-sm font-black" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>جاري التحميل...</div>}

          {!isLoading && requests.length === 0 && (
            <div className="rounded-2xl p-6 text-sm font-black" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
              لا توجد طلبات حالية.
            </div>
          )}

          {!isLoading && requests.map((req) => (
            <div
              key={req.id}
              className="rounded-[1.75rem] p-5 space-y-3 transition-transform"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black" style={{ color: "var(--text)" }}>طلب #{req.id}</p>
                <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>
                  {getStatusLabel(req.status)}
                </span>
              </div>

              <p className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>{req.homeLocation} ← {req.workLocation}</p>

              <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                السائق: {req.selectedDriver?.name?.trim() || "لم يتم التعيين بعد"}
              </p>

              <div className="flex items-center gap-2">
                <Link
                  href={`/client/request/${req.id}`}
                  className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-black"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  إدارة الطلب
                </Link>
                <button
                  type="button"
                  onClick={() => archiveRequest.mutate(req.id)}
                  disabled={archiveRequest.isPending}
                  className="rounded-xl px-3 py-2.5 text-xs font-black inline-flex items-center gap-1"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-sub)" }}
                >
                  <Archive size={13} /> أرشفة
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
}
