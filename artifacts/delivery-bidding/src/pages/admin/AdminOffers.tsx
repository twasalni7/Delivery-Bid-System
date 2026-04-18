import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers();

  return (
    <Layout role="admin">
      <div dir="rtl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900">العروض</h1>
          <p className="text-gray-500 text-base mt-0.5">جميع عروض السائقين على الطلبات</p>
        </div>

        {isLoading && <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>}

        {!isLoading && (!offers || offers.length === 0) && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-5xl mb-4">💰</p>
            <p className="text-xl font-bold text-gray-600">لا توجد عروض بعد</p>
          </div>
        )}

        {offers && offers.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600 w-14">#</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الطلب</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السائق</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السعر الشهري</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">المركبة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الجنسية</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer, idx) => (
                    <tr key={offer.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-5 py-4 text-sm font-mono text-gray-400 font-bold">#{offer.id}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg">
                          طلب #{offer.requestId}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-base shrink-0">🚗</div>
                          <p className="font-black text-gray-900 text-base">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-lg font-black text-green-700" dir="ltr">{offer.price.toFixed(0)} ر.س</span>
                        <span className="text-sm text-gray-400">/شهر</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{offer.carType || "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{offer.nationality || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-400">
                إجمالي: <strong className="text-gray-700">{offers.length}</strong> عرض
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {offers.map((offer) => (
                <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-lg">طلب #{offer.requestId}</span>
                        <span className="font-black text-gray-900 text-base">{offer.driver?.name ?? `سائق #${offer.driverId}`}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="font-black text-green-700 text-base" dir="ltr">{offer.price.toFixed(0)} ر.س/شهر</span>
                        {offer.carType && <span>🚗 {offer.carType}</span>}
                        {offer.nationality && <span>🌐 {offer.nationality}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
