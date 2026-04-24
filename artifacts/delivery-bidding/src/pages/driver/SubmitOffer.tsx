import { useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useCreateOffer, getGetRequestQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Clock, Users, CheckCircle } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

export default function SubmitOffer() {
  const [, params] = useRoute("/driver/request/:id");
  const requestId = parseInt(params?.id ?? "0");
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
    return <Layout role="driver"><div className="text-center py-20 text-gray-400">جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="driver">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold text-gray-700">الطلب غير موجود</p>
          <Link href="/driver/dashboard">
            <div className="mt-4 inline-block px-5 py-2 rounded-full text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
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
        <Link href="/driver/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
          <ArrowRight size={14} /> العودة للوحة السائق
        </Link>

        {/* Request Card */}
        <div className="rounded-2xl overflow-hidden shadow-md mb-5" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">مفتوح</span>
              <span className="text-white/60 text-xs">REQ-{String(request.id).padStart(3, "0")}</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">
                {(request as any).clientType === "موظفات" ? "👩‍💼" : (request as any).clientType === "طلاب" ? "🎓" : (request as any).clientType === "مدارس" ? "🏫" : "📦"}
              </span>
              <div>
                <p className="text-white font-black text-lg">{(request as any).clientType || "طلب توصيل"}</p>
                <p className="text-white/70 text-xs">{request.offerCount ?? 0} سائق قبل</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-white/70 mt-0.5 shrink-0" />
                <p className="text-white/90 text-sm">{request.homeLocation}</p>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-white/70 mt-0.5 shrink-0" />
                <p className="text-white/90 text-sm">{request.workLocation}</p>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Clock size={11} />
                  <span dir="ltr">{formatTime12h(request.morningTime)}{request.eveningTime ? ` – ${formatTime12h(request.eveningTime)}` : ""}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Users size={11} />
                  <span>{request.numberOfPeople} أشخاص</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 px-5 py-3">
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_AR.map((d, i) => {
                const active = i < (request.workingDaysPerWeek ?? 5);
                return (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-white text-green-700" : "bg-white/20 text-white/50"}`}>
                    {d}
                  </span>
                );
              })}
              <span className="text-white/60 text-xs mr-auto">أيام العمل</span>
            </div>
          </div>
        </div>

        {/* Monthly Price */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5 text-center">
          <p className="text-gray-400 text-sm mb-1">السعر الشهري المحدد من العميل</p>
          <p className="text-4xl font-black text-gray-900" dir="ltr">
            {(request as any).monthlyPrice?.toFixed(0) ?? "—"}{" "}
            <span className="text-base font-normal text-gray-400">ر.س / شهر</span>
          </p>
        </div>

        {/* Accept Button */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-black text-gray-800">هل تقبل هذا الطلب؟</h2>
            <p className="text-gray-400 text-xs mt-0.5">بالقبول ستظهر في قائمة اختيارات العميل</p>
          </div>
          <div className="p-4 space-y-3">
            <button
              onClick={handleAccept}
              disabled={createOffer.isPending}
              className="w-full py-4 rounded-2xl text-white font-black text-base shadow-md active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
            >
              <CheckCircle size={20} />
              {createOffer.isPending ? "جاري القبول..." : "قبول الطلب"}
            </button>
            <Link href="/driver/dashboard">
              <div className="w-full py-3 rounded-2xl text-center text-gray-500 font-bold text-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                تجاهل
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

