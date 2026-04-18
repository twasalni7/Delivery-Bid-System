import { useState, useMemo } from "react";
import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Search, X, SlidersHorizontal } from "lucide-react";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers({ query: { refetchInterval: 30_000 } });

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    if (!offers) return [];
    const q = search.trim().toLowerCase();
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;
    return offers.filter((o) => {
      if (min !== null && o.price < min) return false;
      if (max !== null && o.price > max) return false;
      if (q) {
        const hay = [
          o.driver?.name ?? "", String(o.requestId), String(o.id),
          o.carType ?? "", o.nationality ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offers, search, minPrice, maxPrice]);

  const minOfferPrice = offers && offers.length > 0 ? Math.min(...offers.map((o) => o.price)) : 0;
  const maxOfferPrice = offers && offers.length > 0 ? Math.max(...offers.map((o) => o.price)) : 0;
  const avgPrice = offers && offers.length > 0 ? offers.reduce((s, o) => s + o.price, 0) / offers.length : 0;

  const activeFilters = (search ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);
  const resetFilters = () => { setSearch(""); setMinPrice(""); setMaxPrice(""); };

  return (
    <Layout role="admin">
      <div dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black text-gray-900">العروض</h1>
            <p className="text-gray-500 text-base mt-0.5">
              {offers ? `${filtered.length} من ${offers.length} عرض` : "جميع عروض السائقين"}
            </p>
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold border transition-colors ${showFilters || activeFilters > 0 ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <SlidersHorizontal size={15} />
            فلترة
            {activeFilters > 0 && <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">{activeFilters}</span>}
          </button>
        </div>

        {/* Stats bar */}
        {offers && offers.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-green-700" dir="ltr">{minOfferPrice.toFixed(0)}</p>
              <p className="text-sm font-bold text-green-600">أقل سعر (ر.س)</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-blue-700" dir="ltr">{avgPrice.toFixed(0)}</p>
              <p className="text-sm font-bold text-blue-600">متوسط السعر</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-amber-700" dir="ltr">{maxOfferPrice.toFixed(0)}</p>
              <p className="text-sm font-bold text-amber-600">أعلى سعر (ر.س)</p>
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 px-4 py-2.5 shadow-sm focus-within:border-violet-400 transition-colors">
            <Search size={17} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="ابحث باسم السائق، رقم الطلب، المركبة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-base bg-transparent outline-none text-gray-800 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>}
          </div>

          {showFilters && (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 shadow-sm space-y-4">
              <p className="text-sm font-black text-gray-700">فلترة بنطاق السعر (ر.س/شهر)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">من</label>
                  <input
                    type="number" min="0" placeholder="0" value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-violet-400 transition-colors"
                    dir="ltr"
                  />
                </div>
                <span className="text-gray-400 font-bold mt-5">—</span>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">إلى</label>
                  <input
                    type="number" min="0" placeholder="غير محدد" value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-violet-400 transition-colors"
                    dir="ltr"
                  />
                </div>
              </div>
              {activeFilters > 0 && (
                <button onClick={resetFilters}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                  <X size={13} /> مسح جميع الفلاتر
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading && <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-5xl mb-4">{activeFilters > 0 ? "🔍" : "💰"}</p>
            <p className="text-xl font-bold text-gray-600">{activeFilters > 0 ? "لا توجد عروض مطابقة" : "لا توجد عروض بعد"}</p>
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
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السعر الشهري</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">المركبة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الجنسية</th>
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
                يُعرض <strong className="text-gray-700">{filtered.length}</strong> من <strong className="text-gray-700">{offers?.length ?? 0}</strong> عرض
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((offer) => (
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
