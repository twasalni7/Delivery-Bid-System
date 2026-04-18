import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useGetRequestOffers, useSelectOffer, getGetRequestQueryKey, getGetRequestOffersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Phone, MapPin, Clock, Users, Calendar, CheckCircle, Car, Globe, MessageCircle, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import type { Offer } from "@workspace/api-client-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

const SEEN_KEY = (id: number) => `seen_offers_${id}`;

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

const STATUS_GRADIENT: Record<string, string> = {
  OPEN:      "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  BIDDING:   "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  SELECTED:  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  ACTIVE:    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  COMPLETED: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
  CANCELLED: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  EXPIRED:   "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
  FROZEN:    "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
};

type SortOption = "price_asc" | "price_desc" | "date_desc";

const SORT_LABELS: Record<SortOption, string> = {
  price_asc: "الأرخص أولاً",
  price_desc: "الأغلى أولاً",
  date_desc: "الأحدث أولاً",
};

export default function RequestDetails() {
  const [, params] = useRoute("/client/request/:id");
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sort, setSort] = useState<SortOption>("price_asc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: request, isLoading: loadingReq } = useGetRequest(id, {
    query: { queryKey: getGetRequestQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });
  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(id, {
    query: { queryKey: getGetRequestOffersQueryKey(id), enabled: !!id, refetchInterval: 10_000 },
  });

  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!offers || !id) return;
    const currentCount = offers.length;
    const storedSeen = parseInt(localStorage.getItem(SEEN_KEY(id)) ?? "-1", 10);
    if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
      const newCount = currentCount - prevCountRef.current;
      toast({ title: `وصل ${newCount} عرض جديد!`, description: "تحقق من أحدث عروض السائقين أدناه." });
    }
    prevCountRef.current = currentCount;
    if (currentCount > storedSeen) {
      localStorage.setItem(SEEN_KEY(id), String(currentCount));
    }
  }, [offers, id, toast]);

  const selectOffer = useSelectOffer();

  const handleSelect = (offerId: number) => {
    selectOffer.mutate(
      { id, data: { offerId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(id) });
          toast({ title: "تم اختيار السائق بنجاح!" });
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل الاختيار", variant: "destructive" });
        },
      }
    );
  };

  const filteredAndSortedOffers = (() => {
    if (!offers) return [];
    let result = [...offers];

    const min = minPrice !== "" ? parseFloat(minPrice) : undefined;
    const max = maxPrice !== "" ? parseFloat(maxPrice) : undefined;

    if (min !== undefined && !isNaN(min)) {
      result = result.filter((o) => (o.price ?? 0) >= min);
    }
    if (max !== undefined && !isNaN(max)) {
      result = result.filter((o) => (o.price ?? 0) <= max);
    }

    if (sort === "price_asc") {
      result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sort === "price_desc") {
      result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (sort === "date_desc") {
      result.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db2 - da;
      });
    }

    return result;
  })();

  const hasActiveFilter =
    minPrice !== "" || maxPrice !== "" || sort !== "price_asc";

  if (loadingReq) {
    return <Layout role="client"><div className="text-center py-20 text-gray-400">جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="text-5xl mb-3">😕</p>
          <p className="font-bold text-lg text-gray-700">الطلب غير موجود</p>
          <Link href="/client">
            <div className="mt-4 inline-block px-5 py-2 rounded-full bg-blue-600 text-white font-bold text-sm">العودة</div>
          </Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN" || request.status === "BIDDING";
  const gradient = STATUS_GRADIENT[request.status] ?? STATUS_GRADIENT.OPEN;

  return (
    <Layout role="client">
      <div dir="rtl" className="pb-6">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4">
          <ArrowRight size={14} /> العودة
        </Link>

        <div className="rounded-2xl overflow-hidden shadow-md mb-5">
          <div className="p-5 text-white" style={{ background: gradient }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
                {getStatusLabel(request.status)}
              </span>
              <span className="text-white/60 text-xs">طلب #{request.id}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-white/80 text-sm mt-0.5">📍</span>
                <div>
                  <p className="text-white/60 text-xs">من</p>
                  <p className="text-white font-bold text-sm">{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-white/80 text-sm mt-0.5">📍</span>
                <div>
                  <p className="text-white/60 text-xs">إلى</p>
                  <p className="text-white font-bold text-sm">{request.workLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-white/80 text-sm">
                  <Clock size={13} />
                  <span dir="ltr">{formatTime12h(request.morningTime)}</span>
                  {request.eveningTime && <span dir="ltr"> – {formatTime12h(request.eveningTime)}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-white/80 text-sm">
                  <Users size={13} />
                  <span>{request.numberOfPeople} {request.numberOfPeople === 1 ? "شخص" : "أشخاص"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-xs text-gray-500">{request.workingDaysPerWeek} أيام/أسبوع</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_AR.map((d, i) => {
                const active = i < (request.workingDaysPerWeek ?? 5);
                return (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                    {d}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {request.selectedDriver && (request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED") && (
          <div className="rounded-2xl overflow-hidden shadow-md mb-5">
            <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} />
                <span className="font-bold">
                  {request.status === "COMPLETED" ? "تمت الاتفاقية" : "تم اختيار السائق"}
                </span>
              </div>
              <p className="text-2xl font-black">{request.selectedDriver.name}</p>
              {request.selectedDriver.carType && (
                <p className="text-white/70 text-xs mt-0.5">{request.selectedDriver.carType}</p>
              )}
            </div>
            {request.selectedDriver.mobile && (
              <div className="bg-white px-4 py-3 flex items-center gap-3">
                <Phone size={14} className="text-green-600" />
                <a href={`tel:${request.selectedDriver.mobile}`} className="text-sm font-bold text-gray-800" dir="ltr">
                  {request.selectedDriver.mobile}
                </a>
                <a
                  href={`https://wa.me/${request.selectedDriver.mobile.replace(/\D/g, "").replace(/^0/, "966")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mr-auto bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <MessageCircle size={11} /> واتساب
                </a>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-gray-900">
              عروض السائقين {offers ? `(${offers.length})` : ""}
            </h2>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                hasActiveFilter
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <SlidersHorizontal size={12} />
              تصفية وترتيب
              {hasActiveFilter && <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black">!</span>}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><ArrowUpDown size={11} /> الترتيب</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSort(key)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                        sort === key
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {SORT_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">نطاق السعر (ر.س / شهر)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="من"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <span className="text-gray-400 text-sm shrink-0">—</span>
                  <input
                    type="number"
                    placeholder="إلى"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {hasActiveFilter && (
                <button
                  onClick={() => { setSort("price_asc"); setMinPrice(""); setMaxPrice(""); }}
                  className="text-xs text-red-500 font-bold hover:underline"
                >
                  إعادة ضبط الفلتر
                </button>
              )}
            </div>
          )}

          {loadingOffers && <div className="text-center py-8 text-gray-400 text-sm">جاري التحميل...</div>}

          {!loadingOffers && (!offers || offers.length === 0) && (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <p className="text-3xl mb-2">⏳</p>
              <p className="font-bold text-gray-700">لا توجد عروض بعد</p>
              <p className="text-gray-400 text-sm mt-1">ستظهر عروض السائقين هنا عند تقديمها</p>
            </div>
          )}

          {!loadingOffers && offers && offers.length > 0 && filteredAndSortedOffers.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <p className="text-3xl mb-2">🔍</p>
              <p className="font-bold text-gray-700">لا توجد عروض ضمن النطاق المحدد</p>
              <button
                onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                className="mt-2 text-sm text-blue-600 font-bold hover:underline"
              >
                إزالة فلتر السعر
              </button>
            </div>
          )}

          <div className="space-y-3">
            {filteredAndSortedOffers.map((offer: Offer) => {
              const isSelected = request.selectedDriverId === offer.driverId;
              return (
                <div key={offer.id} className={`rounded-2xl overflow-hidden shadow-sm ${isSelected ? "shadow-md" : ""}`}>
                  {isSelected && (
                    <div className="px-4 py-2 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                      <CheckCircle size={14} className="text-white" />
                      <span className="text-white text-xs font-bold">السائق المختار</span>
                    </div>
                  )}
                  <div className="bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-black text-blue-600">
                            {offer.driver?.name?.charAt(0) ?? "س"}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-0.5">
                              {offer.carType && offer.carType !== "—" && (
                                <span className="flex items-center gap-1"><Car size={10} /> {offer.carType}</span>
                              )}
                              {offer.nationality && offer.nationality !== "—" && (
                                <span className="flex items-center gap-1"><Globe size={10} /> {offer.nationality}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-gray-900" dir="ltr">
                          {offer.price?.toFixed(0)} <span className="text-sm font-normal text-gray-400">ر.س / شهر</span>
                        </p>
                      </div>
                      {isOpen && !request.selectedDriverId && (
                        <button
                          onClick={() => handleSelect(offer.id)}
                          disabled={selectOffer.isPending}
                          className="px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                        >
                          اختيار
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
