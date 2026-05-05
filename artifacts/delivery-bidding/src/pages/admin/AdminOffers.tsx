import { useState, useMemo } from "react";
import { useListOffers } from "@workspace/api-client-react";
import type { Offer } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Search, X } from "lucide-react";

type OfferRow = Offer & {
  status?: "PENDING" | "SELECTED" | "CANCELLED";
};

export default function AdminOffers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawOffers, isLoading } = useListOffers({ query: { refetchInterval: 30_000 } as any });
  const offers = rawOffers as OfferRow[] | undefined;

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
            <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>القبولات</h1>
            <p className="text-base mt-0.5" style={{ color: "var(--text-muted)" }}>
              {offers ? `${filtered.length} من ${offers.length} قبول` : "جميع قبولات السائقين"}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {offers && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl px-4 py-3 text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-2xl font-black" style={{ color: "var(--status-open-text)" }}>{offers.filter((o) => o.status === "PENDING").length}</p>
              <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>قيد الانتظار</p>
            </div>
            <div className="rounded-2xl px-4 py-3 text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-2xl font-black" style={{ color: "var(--brand)" }}>{offers.filter((o) => o.status === "SELECTED").length}</p>
              <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>تم اختيارهم</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-colors" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <Search size={17} className="text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="ابحث باسم السائق أو رقم الطلب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-base bg-transparent outline-none"
              style={{ color: "var(--text)" }}
            />
            {search && <button onClick={() => setSearch("")} style={{ color: "var(--text-hint)" }}><X size={15} /></button>}
          </div>
        </div>

        {isLoading && <div className="text-center py-20 text-lg" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-24 rounded-2xl" style={{ border: "2px dashed var(--border-subtle)" }}>
            <p className="text-5xl mb-4">{activeFilters > 0 ? "🔍" : "✋"}</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-muted)" }}>{activeFilters > 0 ? "لا توجد قبولات مطابقة" : "لا توجد قبولات بعد"}</p>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}>مسح الفلاتر</button>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <table className="w-full" dir="rtl">
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th className="text-right px-5 py-4 text-sm font-black w-14" style={{ color: "var(--text-muted)" }}>#</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>الطلب</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>السائق</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>الحالة</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "var(--text-muted)" }}>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((offer, idx) => (
                    <tr key={offer.id} style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: idx % 2 === 1 ? "var(--border-subtle)" : undefined }}>
                      <td className="px-5 py-4 text-sm font-mono font-bold" style={{ color: "var(--text-hint)" }}>#{offer.id}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>طلب #{offer.requestId}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ backgroundColor: "var(--brand-subtle)" }}>🚗</div>
                          <p className="font-black text-base" style={{ color: "var(--text)" }}>{offer.driver?.name ?? `سائق #${offer.driverId}`}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={offer.status === "SELECTED" ? { backgroundColor: "var(--brand-border)", color: "var(--brand)" } : offer.status === "CANCELLED" ? { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" } : { backgroundColor: "var(--status-open-bg)", color: "var(--status-open-text)" }}>
                          {offer.status === "PENDING" ? "منتظر" : offer.status === "SELECTED" ? "مختار" : "ملغي"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "var(--text-hint)" }}>{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString("ar-SA") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 text-sm" style={{ backgroundColor: "var(--surface-2)", borderTop: "1px solid var(--border-subtle)", color: "var(--text-hint)" }}>
                يُعرض <strong style={{ color: "var(--text)" }}>{filtered.length}</strong> من <strong style={{ color: "var(--text)" }}>{offers?.length ?? 0}</strong> قبول
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((offer) => (
                <div key={offer.id} className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: "var(--brand-subtle)" }}>✋</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: "var(--brand-subtle)", color: "var(--brand)" }}>طلب #{offer.requestId}</span>
                        <span className="font-black text-base" style={{ color: "var(--text)" }}>{offer.driver?.name ?? `سائق #${offer.driverId}`}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={offer.status === "SELECTED" ? { backgroundColor: "var(--brand-border)", color: "var(--brand)" } : offer.status === "CANCELLED" ? { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" } : { backgroundColor: "var(--status-open-bg)", color: "var(--status-open-text)" }}>
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
