import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetRequest, useGetRequestOffers, useSelectOffer, getGetRequestQueryKey, getGetRequestOffersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Phone, MapPin, Clock, Users, Calendar, CheckCircle, Car, Globe, MessageCircle } from "lucide-react";
import type { Offer } from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح", SELECTED: "تم الاختيار", ACTIVE: "نشط", COMPLETED: "مكتمل", CANCELLED: "ملغى",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

export default function RequestDetails() {
  const [, params] = useRoute("/client/request/:id");
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: request, isLoading: loadingReq } = useGetRequest(id, { query: { queryKey: getGetRequestQueryKey(id), enabled: !!id } });
  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(id, { query: { queryKey: getGetRequestOffersQueryKey(id), enabled: !!id } });
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

  if (loadingReq) {
    return <Layout role="client"><div className="text-center py-20 text-muted-foreground">جاري التحميل...</div></Layout>;
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="font-bold text-lg">الطلب غير موجود</p>
          <Button asChild className="mt-4"><Link href="/client">العودة</Link></Button>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";

  return (
    <Layout role="client">
      <div className="max-w-2xl mx-auto" dir="rtl">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للطلبات
        </Link>

        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black">طلب #{request.id}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border mt-1 ${STATUS_COLORS[request.status] || ""}`}>
              {STATUS_LABELS[request.status] || request.status}
            </span>
          </div>
        </div>

        <Card className="border-2 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">تفاصيل الرحلة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-muted-foreground mb-0.5">من</p>
                  <p>{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-muted-foreground mb-0.5">إلى</p>
                  <p>{request.workLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-muted-foreground mb-0.5">الأوقات</p>
                  <p dir="ltr">{request.morningTime} ← {request.eveningTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-muted-foreground mb-0.5">الجدول</p>
                  <p>{request.workingDaysPerWeek} أيام/أسبوع</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users size={15} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-muted-foreground mb-0.5">الأشخاص</p>
                  <p>{request.numberOfPeople} {request.numberOfPeople === 1 ? "شخص" : "أشخاص"}</p>
                </div>
              </div>
              {request.phone && (
                <div className="flex items-start gap-2">
                  <Phone size={15} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-muted-foreground mb-0.5">رقم تواصلك</p>
                    <p dir="ltr">{request.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {request.selectedDriver && (request.status === "SELECTED" || request.status === "ACTIVE" || request.status === "COMPLETED") && (
          <Card className="border-2 border-green-300 bg-green-50/30 mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle size={18} className="text-green-700" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-green-800 mb-0.5">
                    {request.status === "COMPLETED" ? "تمت الاتفاقية — بيانات التواصل" : "تم اختيار السائق"}
                  </p>
                  <p className="text-base font-black">{request.selectedDriver.name}</p>
                  {request.selectedDriver.carType && (
                    <p className="text-xs text-muted-foreground mt-0.5">{request.selectedDriver.carType}</p>
                  )}
                  {request.selectedDriver.mobile ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`tel:${request.selectedDriver.mobile}`}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                        dir="ltr"
                      >
                        <Phone size={14} /> {request.selectedDriver.mobile}
                      </a>
                      <a
                        href={`https://wa.me/${request.selectedDriver.mobile.replace(/\D/g, "").replace(/^0/, "966")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="font-bold text-green-700 border-green-300 hover:bg-green-100 gap-1 text-xs">
                          <MessageCircle size={13} />
                          واتساب السائق
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">رقم الجوال غير متاح</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-lg font-black mb-4">
            عروض السائقين {offers ? `(${offers.length})` : ""}
          </h2>

          {loadingOffers && <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>}

          {!loadingOffers && (!offers || offers.length === 0) && (
            <div className="text-center py-12 border-2 border-dashed rounded-md">
              <p className="font-bold">لا توجد عروض بعد</p>
              <p className="text-muted-foreground text-sm mt-1">ستظهر عروض السائقين هنا</p>
            </div>
          )}

          <div className="space-y-3">
            {offers?.map((offer: Offer) => {
              const isSelected = request.selectedDriverId === offer.driverId;
              return (
                <Card key={offer.id} className={`border-2 transition-colors ${isSelected ? "border-green-400 bg-green-50/30" : "hover:border-primary/40"}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <p className="font-bold">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded border border-green-300">
                              <CheckCircle size={12} /> مختار
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-black text-primary mb-2" dir="ltr">
                          {offer.price?.toFixed(2)} ر.س <span className="text-sm font-normal text-muted-foreground">/ شهر</span>
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {offer.carType && (
                            <span className="flex items-center gap-1"><Car size={11} /> {offer.carType}</span>
                          )}
                          {offer.nationality && (
                            <span className="flex items-center gap-1"><Globe size={11} /> {offer.nationality}</span>
                          )}
                        </div>
                      </div>
                      {isOpen && !request.selectedDriverId && (
                        <Button
                          size="sm"
                          className="font-bold shrink-0"
                          onClick={() => handleSelect(offer.id)}
                          disabled={selectOffer.isPending}
                        >
                          اختيار
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
