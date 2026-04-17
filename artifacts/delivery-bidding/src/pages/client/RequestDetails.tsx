import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequest,
  useGetRequestOffers,
  useSelectOffer,
  getGetRequestQueryKey,
  getGetRequestOffersQueryKey,
  getListRequestsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, MapPin, Phone, Clock, Users, Calendar, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح",
  SELECTED: "تم الاختيار",
  ACTIVE: "نشط",
  COMPLETED: "مكتمل",
};

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: request, isLoading: loadingRequest } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestOffersQueryKey(reqId) },
  });

  const selectOffer = useSelectOffer();

  const handleSelectOffer = (offerId: number) => {
    selectOffer.mutate(
      { id: reqId, data: { offerId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(reqId) });
          queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(reqId) });
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "تم اختيار السائق!", description: "تم خصم 50 رصيداً من حساب السائق. الطلب أصبح مكتمل الاختيار." });
        },
        onError: (error: { data?: { error?: string } }) => {
          toast({
            title: "فشل الاختيار",
            description: error?.data?.error || "تعذّر اختيار هذا العرض.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (loadingRequest) {
    return (
      <Layout role="client">
        <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="font-bold text-xl">الطلب غير موجود</p>
          <Link href="/client" className="text-primary text-sm mt-4 block hover:underline">العودة للطلبات</Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";

  return (
    <Layout role="client">
      <div className="max-w-3xl mx-auto">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowRight size={14} /> العودة للطلبات
        </Link>

        <Card className="border-2 mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-black">طلب رقم #{request.id}</CardTitle>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-bold border ${STATUS_COLORS[request.status] || ""}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">موقع المنزل</p>
                  <p className="font-medium">{request.homeLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">موقع العمل</p>
                  <p className="font-medium">{request.workLocation}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t text-sm">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-xs">الأشخاص:</span>
                <span className="font-bold">{request.numberOfPeople}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-xs">أيام/أسبوع:</span>
                <span className="font-bold">{request.workingDaysPerWeek}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <span dir="ltr" className="font-medium">{request.phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">وقت الذهاب</p>
                  <p className="font-bold" dir="ltr">{request.morningTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">وقت العودة</p>
                  <p className="font-bold" dir="ltr">{request.eveningTime}</p>
                </div>
              </div>
            </div>

            {request.selectedDriver && (
              <div className="flex items-center gap-2 pt-2 border-t bg-green-50 -mx-6 px-6 pb-2 rounded-b-sm">
                <Check size={14} className="text-green-700" />
                <span className="text-sm font-bold text-green-800">السائق المختار: {request.selectedDriver.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">
            العروض المقدّمة {offers ? `(${offers.length})` : ""}
          </h2>
          {!isOpen && (
            <span className="text-xs text-muted-foreground">هذا الطلب مغلق ولا يقبل عروضاً جديدة</span>
          )}
        </div>

        {loadingOffers && (
          <div className="text-center py-10 text-muted-foreground text-sm">جاري تحميل العروض...</div>
        )}

        {!loadingOffers && (!offers || offers.length === 0) && (
          <div className="text-center py-14 border-2 border-dashed rounded-sm">
            <p className="font-bold">لا توجد عروض بعد</p>
            <p className="text-muted-foreground text-sm mt-1">سيقوم السائقون بتقديم عروضهم قريباً</p>
          </div>
        )}

        {offers && offers.length > 0 && (
          <div className="border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold text-xs">السائق</TableHead>
                  <TableHead className="font-bold text-xs">السعر الشهري</TableHead>
                  <TableHead className="font-bold text-xs">نوع السيارة</TableHead>
                  <TableHead className="font-bold text-xs">الجنسية</TableHead>
                  {isOpen && <TableHead className="font-bold text-xs">اختيار</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow
                    key={offer.id}
                    className={`hover:bg-muted/30 transition-colors ${request.selectedDriverId === offer.driverId ? "bg-amber-50" : ""}`}
                  >
                    <TableCell className="font-medium">{offer.driver?.name ?? `سائق #${offer.driverId}`}</TableCell>
                    <TableCell className="font-bold text-primary" dir="ltr">{offer.price.toFixed(2)} ر.س</TableCell>
                    <TableCell className="text-sm">{offer.carType}</TableCell>
                    <TableCell className="text-sm">{offer.nationality}</TableCell>
                    {isOpen && (
                      <TableCell>
                        <Button
                          size="sm"
                          className="font-bold text-xs"
                          onClick={() => handleSelectOffer(offer.id)}
                          disabled={selectOffer.isPending}
                        >
                          <Check size={12} className="ml-1" /> اختيار
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
