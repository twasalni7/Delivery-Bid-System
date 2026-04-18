import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useCreateOffer, getGetRequestQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Clock, Users } from "lucide-react";
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

  const [price, setPrice] = useState("");
  const [carType, setCarType] = useState("");
  const [nationality, setNationality] = useState("");

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      toast({ title: "يرجى إدخال سعر صحيح", variant: "destructive" });
      return;
    }
    createOffer.mutate(
      { data: { requestId, price: numPrice, carType: carType.trim() || "—", nationality: nationality.trim() || "—" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(requestId) });
          toast({ title: "تم تقديم العرض بنجاح!" });
          setLocation("/driver/dashboard");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل تقديم العرض", variant: "destructive" });
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

        <div className="rounded-2xl overflow-hidden shadow-md mb-5" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                {request.status === "BIDDING" ? "قيد المزايدة" : "مفتوح"}
              </span>
              <span className="text-white/60 text-xs">REQ-{String(request.id).padStart(3, "0")}</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">
                {(request as any).clientType === "موظفات" ? "👩‍💼" : (request as any).clientType === "طلاب" ? "🎓" : (request as any).clientType === "مدارس" ? "🏫" : "📦"}
              </span>
              <div>
                <p className="text-white font-black text-lg">{(request as any).clientType || "طلب توصيل"}</p>
                <p className="text-white/70 text-xs">{request.offerCount ?? 0} عروض مقدمة</p>
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

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-black text-gray-800">تقديم عرضك الشهري</h2>
            <p className="text-gray-400 text-xs mt-0.5">حدد سعرك التنافسي لهذا الطلب</p>
          </div>
          <div className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">السعر الشهري (ريال) *</label>
                <div className="relative">
                  <Input
                    type="number" min="1" step="1"
                    placeholder="مثال: 850"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-green-400 text-lg font-black pl-14"
                    dir="ltr"
                    autoFocus
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">ر.س</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">نوع السيارة</label>
                <Input
                  placeholder="مثال: تويوتا كامري 2022"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-green-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الجنسية</label>
                <Input
                  placeholder="مثال: سعودي"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-green-400"
                />
              </div>
              <button
                type="submit"
                disabled={createOffer.isPending || !price}
                className="w-full py-4 rounded-2xl text-white font-black text-base shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
              >
                {createOffer.isPending ? "جاري الإرسال..." : "قدّم عرضك الشهري"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
