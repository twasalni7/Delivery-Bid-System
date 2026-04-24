import { useState, useMemo } from "react";
import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Search, X } from "lucide-react";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers({ query: { refetchInterval: 30_000 } });

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!offers) return [];
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      if (q) {
        const hay = [
          o.driver?.name ?? "", String(o.requestId), String(o.id),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offers, search]);

  const activeFilters = search ? 1 : 0;
  const resetFilters = () => { setSearch(""); };

  return (
    <Layout role="admin">
      <div dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black text-gray-900">القبولات</h1>
            <p className="text-gray-500 text-base mt-0.5">
              {offers ? `${filtered.length} من ${offers.length} قبول` : "جميع قبولات السائقين"}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {offers && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-blue-700">{offers.filter((o) => o.status === "PENDING").length}</p>
              <p className="text-sm font-bold text-blue-600">قيد الانتظار</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-green-700">{offers.filter((o) => o.status === "SELECTED").length}</p>
              <p className="text-sm font-bold text-green-600">تم اختيارهم</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 px-4 py-2.5 shadow-sm focus-within:border-violet-400 transition-colors">
            <Search size={17} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="ابحث باسم السائق أو رقم الطلب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-base bg-transparent outline-none text-gray-800 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>}
          </div>
        </div>

        {isLoading && <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-5xl mb-4">{activeFilters > 0 ? "🔍" : "✋"}</p>
            <p className="text-xl font-bold text-gray-600">{activeFilters > 0 ? "لا توجد قبولات مطابقة" : "لا توجد قبولات بعد"}</p>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-violet-600 border border-violet-200 hover:bg-violet-50">مسح الفلاتر</button>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600 w-14">#</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الطلب</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السائق</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الحالة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((offer, idx) => (
                    <tr key={offer.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-5 py-4 text-sm font-mono text-gray-400 font-bold">#{offer.id}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg">طلب #{offer.requestId}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-base shrink-0">🚗</div>
                          <p className="font-black text-gray-900 text-base">{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${offer.status === "SELECTED" ? "bg-green-100 text-green-700" : offer.status === "CANCELLED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                          {offer.status === "PENDING" ? "منتظر" : offer.status === "SELECTED" ? "مختار" : "ملغي"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString("ar-SA") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-400">
                يُعرض <strong className="text-gray-700">{filtered.length}</strong> من <strong className="text-gray-700">{offers?.length ?? 0}</strong> قبول
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((offer) => (
                <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-2xl shrink-0">✋</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-lg">طلب #{offer.requestId}</span>
                        <span className="font-black text-gray-900 text-base">{offer.driver?.name ?? `سائق #${offer.driverId}`}</span>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${offer.status === "SELECTED" ? "bg-green-100 text-green-700" : offer.status === "CANCELLED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                        {offer.status === "PENDING" ? "منتظر" : offer.status === "SELECTED" ? "مختار" : "ملغي"}
                      </span>
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
