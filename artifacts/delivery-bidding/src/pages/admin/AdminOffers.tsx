import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers();

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">العروض</h1>
          <p className="text-gray-400 text-sm">جميع عروض السائقين على الطلبات</p>
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {!isLoading && (!offers || offers.length === 0) && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-bold text-gray-500">لا توجد عروض بعد</p>
          </div>
        )}

        <div className="space-y-3">
          {offers?.map((offer) => (
            <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">💰</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs text-gray-300 font-mono">طلب #{offer.requestId}</span>
                    <span className="font-black text-gray-900">{offer.driver?.name ?? `سائق #${offer.driverId}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="font-black text-green-600" dir="ltr">{offer.price.toFixed(2)} ر.س/شهر</span>
                    {offer.carType && <span>🚗 {offer.carType}</span>}
                    {offer.nationality && <span>🌐 {offer.nationality}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
