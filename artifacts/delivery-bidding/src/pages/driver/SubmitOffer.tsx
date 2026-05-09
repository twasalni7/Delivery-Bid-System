import { useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useCreateOffer, getGetRequestQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { LocationDisplay } from "@/components/LocationDisplay";
import { formatTime12hLong } from "@/lib/time-utils";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

const CLIENT_TYPE_EMOJI: Record<string, string> = {
  موظفات: "👩‍💼",
  طلاب: "🎓",
  مدارس: "🏫",
  موظفون: "👔",
  موظفين: "👔",
};

export default function SubmitOffer() {
  const [, params] = useRoute("/driver/request/:id");
  const requestId = parseInt((params as { id: string } | null)?.id ?? "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: request, isLoading } = useGetRequest(requestId, {
    query: { queryKey: getGetRequestQueryKey(requestId), enabled: !!requestId },
  });
  const createOffer = useCreateOffer();

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  const handleAccept = () => {
    createOffer.mutate(
      { data: { requestId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
          toast({ title: "تم القبول بنجاح!", description: "ستظهر في قائمة العميل وينتظر تأكيده." });
          setLocation("/driver/dashboard");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل القبول", variant: "destructive" });
        },
      }
    );
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <Layout role="driver">
        <div className="text-center py-20 font-bold" style={{ color: "var(--text-hint)" }}>
          جاري التحميل...
        </div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout role="driver">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold" style={{ color: "var(--text)" }}>الطلب غير موجود</p>
          <Link href="/driver/dashboard">
            <div className="mt-4 inline-block px-5 py-2 rounded-full font-bold text-sm"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
              العودة
            </div>
          </Link>
        </div>
      </Layout>
    );
  }

  const clientType = (request as any).clientType || "طلب توصيل";
  const emoji = CLIENT_TYPE_EMOJI[clientType] ?? "📦";
  const shifts = request.shifts as Array<{ label?: string; goTime?: string; returnTime?: string }> | null;
  const hasShifts = shifts && shifts.length > 0;
  const shiftRows = hasShifts
    ? shifts!.map((s, i) => ({ label: s.label ?? `الوردية ${i + 1}`, go: s.goTime ?? "", back: s.returnTime ?? "" }))
    : [{ label: "الوردية الأولى", go: request.morningTime, back: request.eveningTime ?? "" }];
  const numPeople = (request as any).numberOfPeople ?? 1;
  const totalPrice = (request as any).monthlyPrice ?? 0;
  const perPersonPrice = numPeople > 1 ? (totalPrice / numPeople).toFixed(0) : null;

  return (
    <Layout role="driver">
      <div dir="rtl" className="pb-24 space-y-4">

        {/* زر العودة */}
        <Link href="/driver/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl"
          style={{ color: "var(--text-muted)", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ArrowRight size={14} /> العودة
        </Link>

        {/* ── ملخص الطلب ── */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(150deg, rgba(20,31,50,0.85) 0%, rgba(9,13,22,0.97) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>

          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{emoji}</span>
              <div>
                <p className="font-black text-lg" style={{ color: "var(--text)" }}>{clientType}</p>
                <p className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                  REQ-{String(request.id).padStart(3, "0")}
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full"
              style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
              مفتوح
            </span>
          </div>

          {/* المسار */}
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--brand)", boxShadow: "0 0 6px rgba(222,255,154,0.5)" }} />
              <LocationDisplay value={request.homeLocation}
                className="text-sm font-black" style={{ color: "var(--text)" }} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--status-cancelled-text)", boxShadow: "0 0 6px rgba(248,113,113,0.4)" }} />
              <LocationDisplay value={request.workLocation}
                className="text-sm font-black" style={{ color: "var(--text)" }} />
            </div>
          </div>

          {/* الأوقات */}
          <div className="px-5 py-4 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {shiftRows.map((s, i) => (
              <div key={i} className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-3 py-1.5 text-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] font-black tracking-wide" style={{ color: "var(--text-hint)" }}>{s.label}</p>
                </div>
                <div className="grid gap-px"
                  style={{ gridTemplateColumns: s.back ? "1fr 1fr" : "1fr", backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div className="px-4 py-3 text-right" style={{ backgroundColor: "var(--surface)" }}>
                    <p className="text-[9px] font-black mb-1" style={{ color: "var(--text-hint)" }}>الذهاب</p>
                    <p className="text-sm font-black" style={{ color: "var(--text)" }} dir="ltr">
                      {formatTime12hLong(s.go)}
                    </p>
                  </div>
                  {s.back && (
                    <div className="px-4 py-3 text-right" style={{ backgroundColor: "var(--surface)" }}>
                      <p className="text-[9px] font-black mb-1" style={{ color: "var(--text-hint)" }}>العودة</p>
                      <p className="text-sm font-black" style={{ color: "var(--text)" }} dir="ltr">
                        {formatTime12hLong(s.back)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* عدد الأشخاص + أيام الأسبوع */}
            <div className="flex items-center gap-3">
              <div className="rounded-2xl px-4 py-2.5 flex items-center justify-between flex-1"
                style={{ backgroundColor: "var(--surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs font-black" style={{ color: "var(--text-hint)" }}>عدد الأشخاص</p>
                <p className="text-lg font-black" style={{ color: "var(--text)" }}>{numPeople}</p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {DAYS_AR.map((d, i) => {
                  const active = i < (request.workingDaysPerWeek ?? 5);
                  return (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={active
                        ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                        : { backgroundColor: "var(--border-subtle)", color: "var(--text-hint)" }}>
                      {d}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── السعر ── */}
        <div className="rounded-3xl px-6 py-5"
          style={{ background: "linear-gradient(150deg, rgba(20,31,50,0.85) 0%, rgba(9,13,22,0.97) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-xs font-black text-center mb-4" style={{ color: "var(--text-hint)" }}>
            السعر الشهري المحدد من العميل
          </p>
          <div className="flex items-end justify-between gap-4">
            {/* السعر الإجمالي — الأهم */}
            <div>
              <p className="text-[10px] font-black mb-1" style={{ color: "var(--text-hint)" }}>الإجمالي / شهر</p>
              <p className="text-5xl font-black leading-none" style={{ color: "var(--brand)" }} dir="ltr">
                {totalPrice.toFixed(0)}
                <span className="text-lg font-normal mr-1" style={{ color: "var(--brand)" }}> ر.س</span>
              </p>
            </div>
            {/* السعر / شخص */}
            {perPersonPrice && (
              <div className="text-right pb-1">
                <p className="text-[10px] font-black mb-1" style={{ color: "var(--text-hint)" }}>السعر / شخص</p>
                <p className="text-2xl font-black leading-none" style={{ color: "var(--text-sub)" }} dir="ltr">
                  {perPersonPrice}
                  <span className="text-sm font-normal mr-1"> ر.س</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── القبول / الإلغاء ── */}
        <div className="rounded-3xl px-5 py-5 space-y-3"
          style={{ background: "linear-gradient(150deg, rgba(20,31,50,0.85) 0%, rgba(9,13,22,0.97) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-center mb-1">
            <p className="font-black text-base" style={{ color: "var(--text)" }}>هل تقبل هذا الطلب؟</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: "var(--text-hint)" }}>
              بالقبول ستظهر في قائمة اختيارات العميل
            </p>
          </div>

          {/* زر القبول */}
          <button onClick={handleAccept} disabled={createOffer.isPending}
            className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: createOffer.isPending
                ? "rgba(239,68,68,0.4)"
                : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#fff",
              boxShadow: createOffer.isPending ? "none" : "0 4px 24px rgba(239,68,68,0.35)",
            }}>
            <CheckCircle2 size={20} />
            {createOffer.isPending ? "جاري القبول..." : "قبول الطلب"}
          </button>

          {/* زر التجاهل */}
          <Link href="/driver/dashboard">
            <button className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <X size={16} />
              تجاهل
            </button>
          </Link>
        </div>

      </div>
    </Layout>
  );
}
