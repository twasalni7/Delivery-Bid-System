import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, User } from "lucide-react";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers();

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="mb-6">
          <h1 className="text-2xl font-black">العروض</h1>
          <p className="text-muted-foreground text-sm mt-0.5">جميع عروض السائقين على الطلبات</p>
        </div>

        {isLoading && <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>}

        {!isLoading && (!offers || offers.length === 0) && (
          <div className="text-center py-20 border-2 border-dashed rounded-md">
            <p className="font-bold">لا توجد عروض بعد</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {offers?.map((offer) => (
            <Card key={offer.id} className="border-2">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-muted-foreground font-mono">طلب #{offer.requestId}</span>
                      {offer.isSelected && (
                        <span className="text-xs bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded font-bold">محدد</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User size={13} className="text-primary" />
                        <span>{offer.driverName ?? `سائق #${offer.driverId}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-primary">
                        <Banknote size={13} />
                        <span dir="ltr">{offer.monthlyPrice?.toFixed(2)} ر.س/شهر</span>
                      </div>
                    </div>
                    {offer.notes && <p className="text-xs text-muted-foreground mt-1">{offer.notes}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
