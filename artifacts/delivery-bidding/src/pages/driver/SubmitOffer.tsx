import { useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useCreateOffer, getGetRequestQueryKey } from "@workspace/api-client-react";
import type { CreateOfferBody } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Clock, Users, CheckCircle, ExternalLink } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

export default function SubmitOffer() {
  const [, params] = useRoute("/driver/request/:id");
  const requestId = parseInt((params as { id: string } | null)?.id ?? "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: request, isLoading } = useGetRequest(requestId, { query: { queryKey: getGetRequestQueryKey(requestId), enabled: !!requestId } });
  const createOffer = useCreateOffer();

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  const handleAccept = () => {
    createOffer.mutate(
      { data: { requestId } as CreateOfferBody },
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
    return <Layout role="driver"><div className="text-center py-20 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="driver">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold" style={{ color: "var(--text)" }}>الطلب غير موجود</p>
          <Link href="/driver/dashboard">
            <div className="mt-4 inline-block px-5 py-2 rounded-full font-bold text-sm" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
              العودة
            </div>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="driver">
      <div dir="rtl" className="pb-6">
        <Link href="/driver/dashboard" className="inline-flex items-center gap-1 text-sm font-bold transition-colors mb-5"
          style={{ color: "var(--text-muted)" }}>
          <ArrowRight size={14} /> العودة للوحة السائق
        </Link>

        {/* Request Card */}
        <div className="rounded-3xl overflow-hidden mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="p-5" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>مفتوح</span>
              <span className="text-xs font-bold" style={{ color: "var(--text-hint)" }}>REQ-{String(request.id).padStart(3, "0")}</span>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">
                {(request as any).clientType === "موظفات" ? "👩‍💼" : (request as any).clientType === "طلاب" ? "🎓" : (request as any).clientType === "مدارس" ? "🏫" : "📦"}
              </span>
              <div>
                <p className="font-black text-lg" style={{ color: "var(--text)" }}>{(request as any).clientType || "طلب توصيل"}</p>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{request.offerCount ?? 0} سائق قبل</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                <p className="text-sm font-black" style={{ color: "var(--text)" }}>{request.homeLocation}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: "var(--status-cancelled-text)" }} />
                <p className="text-sm font-black" style={{ color: "var(--text)" }}>{request.workLocation}</p>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  <Clock size={11} />
                  {request.shifts && request.shifts.length > 0 ? (
                    <span dir="ltr">{request.shifts.map((s) => `${formatTime12h(s.goTime)}${s.returnTime ? ` – ${formatTime12h(s.returnTime)}` : ""}`).join(" | ")}</span>
                  ) : (
                    <span dir="ltr">{formatTime12h(request.morningTime)}{request.eveningTime ? ` – ${formatTime12h(request.eveningTime)}` : ""}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  <Users size={11} />
                  <span>{request.numberOfPeople} أشخاص</span>
                </div>
              </div>
              {request.additionalLocations && request.additionalLocations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {request.additionalLocations.map((loc, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <MapPin size={11} className="shrink-0 mt-0.5" style={{ color: "var(--text-hint)" }} />
                      <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{loc.type === "pickup" ? "استلام إضافي" : "توصيل إضافي"}: {loc.address}</p>
                    </div>
                  ))}
                </div>
              )}
              {request.notes && (
                <p className="text-xs mt-1 font-bold" style={{ color: "var(--text-muted)" }}>📝 {request.notes}</p>
              )}

              {/* Google Maps buttons */}
              {(request.homeLat && request.homeLng) || (request.destLat && request.destLng) ? (
                <div className="flex gap-2 flex-wrap pt-1" dir="rtl">
                  {request.homeLat && request.homeLng && (
                    <a
                      href={`https://www.google.com/maps?q=${request.homeLat},${request.homeLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                      style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }}
                    >
                      <ExternalLink size={11} /> خريطة الانطلاق
                    </a>
                  )}
                  {request.destLat && request.destLng && (
                    <a
                      href={`https://www.google.com/maps?q=${request.destLat},${request.destLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
                    >
                      <ExternalLink size={11} /> خريطة الوصول
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_AR.map((d, i) => {
                const active = i < (request.workingDaysPerWeek ?? 5);
                return (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
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

        {/* Monthly Price */}
        <div className="rounded-3xl p-6 mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-bold mb-3 text-center" style={{ color: "var(--text-muted)" }}>السعر الشهري المحدد من العميل</p>
          {(request as any).numberOfPeople > 1 ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black" style={{ color: "var(--text-hint)" }}>السعر / شخص</p>
                <p className="text-5xl font-black tracking-tight" style={{ color: "var(--brand)" }} dir="ltr">
                  {((request as any).monthlyPrice / (request as any).numberOfPeople).toFixed(0)}{" "}
                  <span className="text-xl font-normal" style={{ color: "var(--brand)" }}>ر.س</span>
                </p>
              </div>
              <div className="text-right pb-1">
                <p className="text-xs font-black" style={{ color: "var(--text-hint)" }}>الإجمالي ({(request as any).numberOfPeople} أشخاص)</p>
                <p className="text-2xl font-black" style={{ color: "var(--text-sub)" }} dir="ltr">
                  {(request as any).monthlyPrice?.toFixed(0) ?? "—"}{" "}
                  <span className="text-sm font-normal">ر.س/شهر</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-5xl font-black tracking-tight text-center" style={{ color: "var(--brand)" }} dir="ltr">
              {(request as any).monthlyPrice?.toFixed(0) ?? "—"}{" "}
              <span className="text-xl font-normal" style={{ color: "var(--brand)" }}>ر.س / شهر</span>
            </p>
          )}
        </div>

        {/* Accept Button */}
        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="font-black" style={{ color: "var(--text)" }}>هل تقبل هذا الطلب؟</h2>
            <p className="text-xs mt-0.5 font-bold" style={{ color: "var(--text-muted)" }}>بالقبول ستظهر في قائمة اختيارات العميل</p>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={handleAccept}
              disabled={createOffer.isPending}
              className="w-full btn-primary disabled:opacity-50"
            >
              <CheckCircle size={20} />
              {createOffer.isPending ? "جاري القبول..." : "قبول الطلب"}
            </button>
            <Link href="/driver/dashboard">
              <div className="w-full py-3.5 rounded-2xl text-center font-bold text-sm cursor-pointer"
                style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                تجاهل
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
