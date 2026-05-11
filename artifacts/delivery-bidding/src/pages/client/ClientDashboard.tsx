import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getStatusLabel } from "@/lib/status-utils";
import { hasArchivedTimestamp } from "@/lib/request-archive-utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Archive, Plus } from "lucide-react";
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

  return (
    <Layout role="client">
      <div dir="rtl" className="space-y-5">
        <section
          className="rounded-[2rem] p-5"
          style={{
            background: "linear-gradient(150deg, rgba(27,29,39,0.95) 0%, rgba(15,17,24,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>مرحباً</p>
              <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>{displayName}</h1>
            </div>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black"
              style={{
                background: "linear-gradient(145deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                boxShadow: "0 12px 24px rgba(124,58,237,0.35)",
              }}
            >
              {displayName.charAt(0)}
            </div>
          </div>
        </section>

        <section
          className="rounded-[2rem] p-6 space-y-4"
          style={{
            background: "linear-gradient(145deg, #7c3aed 0%, #5b21b6 100%)",
            color: "#fff",
            boxShadow: "0 18px 38px rgba(91,33,182,0.45)",
          }}
        >
          <h2 className="text-2xl font-black leading-tight">جاهزة لمشاويرك القادمة؟</h2>
          <p className="text-sm font-bold text-violet-100">حددي مساراتك والشفتات واحصلي على السعر النهائي</p>
          <Link
            href="/client/request/new"
            className="w-full rounded-2xl px-5 py-4 flex items-center justify-center gap-2 text-base font-black"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}
          >
            <Plus size={18} /> طلب اشتراك جديد
          </Link>
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
              className="rounded-[1.5rem] p-4 space-y-3"
              style={{
                background: "linear-gradient(150deg, rgba(23,24,31,0.95) 0%, rgba(16,17,23,0.98) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "var(--shadow-sm)",
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
                  style={{ background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)", color: "#fff" }}
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
