import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getStatusLabel } from "@/lib/status-utils";
import { hasArchivedTimestamp } from "@/lib/request-archive-utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Archive, Bell, MessageCircle, Plus, ShieldCheck, Sparkles, Wallet, LifeBuoy, User, Info } from "lucide-react";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { EnablePushButton } from "@/components/enable-push-button";

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
          className="rounded-[2rem] p-6 space-y-4"
          aria-label="قسم إنشاء طلب توصيل جديد"
          style={{
            background: "linear-gradient(145deg, rgba(0,230,118,0.22) 0%, rgba(21,27,45,0.92) 55%, rgba(10,14,26,0.98) 100%)",
            color: "var(--text)",
            border: "1px solid var(--brand-border)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <h2 className="text-3xl font-black leading-tight">جاهز لطلب توصيل؟</h2>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>حدد تفاصيل مشوارك وسيتم حساب السعر ونشر الطلب للسائقين المناسبين</p>
          <Link
            href="/client/request/new"
            className="w-full rounded-2xl px-5 py-4 flex items-center justify-center gap-2 text-base font-black"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "var(--brand-shadow)" }}
          >
            <Plus size={18} /> طلب اشتراك جديد
          </Link>
        </section>

        <section
          className="rounded-[2rem] p-5 space-y-4"
          aria-label="معلومات الدفع"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}
            >
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg leading-tight" style={{ color: "var(--text)" }}>دفع آمن وشفاف</h3>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>بدون أي دفع مقدم — أسعار واضحة ونهائية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: ShieldCheck, title: "بياناتك محمية", sub: "معلومات العميل داخل التطبيق" },
              { icon: Wallet, title: "لا يوجد دفع مقدم", sub: "ابدأ الآن وادفع لاحقاً" },
              { icon: Sparkles, title: "أسعار نهائية وواضحة", sub: "سعر محسوب قبل نشر الطلب" },
              { icon: MessageCircle, title: "محادثة داخل التطبيق", sub: "تواصل مباشر مع السائق" },
            ].map(({ icon: Icon, title, sub }) => (
              <div
                key={title}
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black" style={{ color: "var(--text)" }}>{title}</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(0,230,118,0.10)", border: "1px solid var(--brand-border)" }}>
            <Info size={15} style={{ color: "var(--brand)" }} />
            <p className="text-xs font-black" style={{ color: "var(--text-sub)" }}>الدفع آخر الشهر للسائق مباشرة — بدون وسطاء.</p>
          </div>
        </section>

        <section
          className="rounded-[2rem] p-5 space-y-3"
          aria-label="إجراءات سريعة"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black" style={{ color: "var(--text)" }}>إجراءات سريعة</h3>
            <Link href="/client/onboarding" className="text-xs font-black" style={{ color: "var(--brand)" }}>تعرف على التطبيق</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/client/request/new", label: "طلب جديد", icon: Plus },
              { href: "/client/notifications", label: "الإشعارات", icon: Bell },
              { href: "/client/profile", label: "حسابي", icon: User },
              { href: "/client/support", label: "الدعم", icon: LifeBuoy },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="rounded-[1.5rem] p-4 flex items-center justify-between gap-3 transition-transform active:scale-[0.99]"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                    <Icon size={18} />
                  </div>
                  <span className="font-black text-sm truncate" style={{ color: "var(--text)" }}>{label}</span>
                </div>
                <span className="text-xs font-black" style={{ color: "var(--text-hint)" }}>←</span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="rounded-[2rem] p-4 grid grid-cols-4 gap-2"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {[
            { icon: Wallet, title: "سعر واضح" },
            { icon: Sparkles, title: "اختيار الأنسب" },
            { icon: MessageCircle, title: "تواصل مباشر" },
            { icon: ShieldCheck, title: "دفع آمن" },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-2xl p-3 text-center space-y-2" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>
                  <Icon size={15} />
                </div>
                <p className="text-xs font-black leading-tight" style={{ color: "var(--text-sub)" }}>{feature.title}</p>
              </div>
            );
          })}
        </section>

        <section
          className="rounded-[2rem] p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3 className="text-2xl font-black" style={{ color: "var(--text)" }}>كيف يعمل النظام؟</h3>
          <div className="space-y-2">
            {[
              "أنشئ طلب التوصيل وحدد التفاصيل",
              "يتم احتساب السعر تلقائياً قبل الإرسال",
              "يتم نشر الطلب للسائقين المناسبين",
              "السائقون المهتمون يرسلون قبولهم",
              "اختر السائق المناسب لك",
              "تواصل معه مباشرة عبر المحادثة أو واتساب",
            ].map((step, idx) => (
              <div key={step} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>{step}</p>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}>
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="rounded-[2rem] p-5 space-y-4"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)", color: "var(--brand)" }}>
              🔔
            </div>
            <div>
              <h3 className="font-black text-base" style={{ color: "var(--text)" }}>الإشعارات الفورية</h3>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>تلقّ تنبيهات عند وصول عروض جديدة</p>
            </div>
          </div>
          <EnablePushButton />
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
