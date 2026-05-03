import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { Plus, Trash2, Save, RefreshCw, AlertTriangle, MapPin, Clock, Users, Settings2 } from "lucide-react";
import type { PricingConfig, PricingTier, SharingDiscount } from "@/lib/pricing";

type ReviewRequest = {
  id: number;
  clientId: number | null;
  homeLocation: string;
  workLocation: string;
  distanceKm: number | null;
  numberOfPeople: number;
  morningTime: string;
  status: string;
  monthlyPrice: number;
  createdAt: string;
};

export default function AdminPricing() {
  const { toast } = useToast();

  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [discounts, setDiscounts] = useState<SharingDiscount[]>([]);
  const [proximityHomeKm, setProximityHomeKm] = useState("2");
  const [proximityWorkKm, setProximityWorkKm] = useState("2");
  const [proximityTimeMinutes, setProximityTimeMinutes] = useState("30");

  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loadingReview, setLoadingReview] = useState(true);
  const [settingPrice, setSettingPrice] = useState<number | null>(null);
  const [customPrices, setCustomPrices] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`${API}/api/pricing/config`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d: PricingConfig) => {
        setConfig(d);
        setTiers([...d.tiers]);
        setDiscounts([...d.sharingDiscounts]);
        setProximityHomeKm(String(d.proximityHomeKm));
        setProximityWorkKm(String(d.proximityWorkKm));
        setProximityTimeMinutes(String(d.proximityTimeMinutes));
      })
      .catch(() => toast({ title: "فشل تحميل إعدادات التسعير", variant: "destructive" }))
      .finally(() => setLoading(false));

    fetch(`${API}/api/pricing/review-requests`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReviewRequests(d); })
      .catch(() => {})
      .finally(() => setLoadingReview(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/pricing/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          tiers,
          sharingDiscounts: discounts,
          proximityHomeKm: parseFloat(proximityHomeKm),
          proximityWorkKm: parseFloat(proximityWorkKm),
          proximityTimeMinutes: parseFloat(proximityTimeMinutes),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الحفظ");
      setConfig(data);
      toast({ title: "✅ تم حفظ إعدادات التسعير" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateTier = (idx: number, field: keyof PricingTier, val: string) => {
    setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: parseFloat(val) || 0 } : t));
  };

  const addTier = () => setTiers((prev) => [...prev, { max: 0, base: 0 }]);
  const removeTier = (idx: number) => setTiers((prev) => prev.filter((_, i) => i !== idx));

  const updateDiscount = (idx: number, field: keyof SharingDiscount, val: string) => {
    setDiscounts((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: parseFloat(val) || 0 } : d));
  };

  const addDiscount = () => setDiscounts((prev) => [...prev, { people: 0, factor: 1.0 }]);
  const removeDiscount = (idx: number) => setDiscounts((prev) => prev.filter((_, i) => i !== idx));

  const handleSetReviewPrice = async (requestId: number) => {
    const price = parseFloat(customPrices[requestId] ?? "");
    if (isNaN(price) || price <= 0) {
      toast({ title: "يرجى إدخال سعر صحيح", variant: "destructive" });
      return;
    }
    setSettingPrice(requestId);
    try {
      const res = await fetch(`${API}/api/admin/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ monthlyPrice: price, needsAdminReview: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التحديث");
      setReviewRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast({ title: `✅ تم تحديد السعر ${price} ريال للطلب #${requestId}` });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSettingPrice(null);
    }
  };

  if (loading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto" style={{ borderColor: "var(--brand-border)", borderTopColor: "var(--brand)" }} />
            <p className="font-bold" style={{ color: "var(--text-muted)" }}>جاري تحميل إعدادات التسعير...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div dir="rtl" className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">إدارة نظام التسعير</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              تعديل نطاقات المسافة، خصومات المشاركة، ومعايير القرب
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm disabled:opacity-50 transition-all active:scale-95"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Distance Tiers ── */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                <MapPin size={18} style={{ color: "var(--brand)" }} />
              </div>
              <div>
                <p className="font-black text-white">نطاقات المسافة والأسعار</p>
                <p className="text-xs" style={{ color: "var(--text-hint)" }}>السعر الشهري الأساسي (ريال) لكل نطاق</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>الحد الأعلى (كم)</p>
                <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>السعر الأساسي (ريال)</p>
                <p />
              </div>
              {tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                  <input
                    type="number"
                    value={tier.max}
                    onChange={(e) => updateTier(idx, "max", e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-white text-center focus:outline-none"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                    min="0"
                  />
                  <input
                    type="number"
                    value={tier.base}
                    onChange={(e) => updateTier(idx, "base", e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-white text-center focus:outline-none"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                    min="0"
                  />
                  <button
                    onClick={() => removeTier(idx)}
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                    style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={addTier}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 border-dashed transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <Plus size={14} /> إضافة نطاق
              </button>
            </div>
          </div>

          {/* ── Sharing Discounts ── */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <Users size={18} style={{ color: "var(--status-frozen-text)" }} />
              </div>
              <div>
                <p className="font-black text-white">خصومات الاشتراك المشترك</p>
                <p className="text-xs" style={{ color: "var(--text-hint)" }}>نسبة السعر لكل شخص (1.0 = 100%)</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>عدد الأشخاص</p>
                <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>معامل الخصم</p>
                <p />
              </div>
              {discounts.map((d, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                  <input
                    type="number"
                    value={d.people}
                    onChange={(e) => updateDiscount(idx, "people", e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-white text-center focus:outline-none"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                    min="1"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      value={d.factor}
                      onChange={(e) => updateDiscount(idx, "factor", e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white text-center focus:outline-none"
                      style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                      min="0" max="1" step="0.01"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "var(--text-hint)" }}>
                      ({Math.round(d.factor * 100)}%)
                    </span>
                  </div>
                  <button
                    onClick={() => removeDiscount(idx)}
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                    style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={addDiscount}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 border-dashed transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <Plus size={14} /> إضافة مستوى خصم
              </button>
            </div>
          </div>

          {/* ── Proximity Settings ── */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <Settings2 size={18} style={{ color: "var(--status-open-text)" }} />
              </div>
              <div>
                <p className="font-black text-white">معايير القرب للاشتراك المشترك</p>
                <p className="text-xs" style={{ color: "var(--text-hint)" }}>الحد الأقصى للمسافة/الوقت للتصنيف كـ"قريبين"</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                  المسافة بين المنازل (كم)
                </label>
                <input
                  type="number"
                  value={proximityHomeKm}
                  onChange={(e) => setProximityHomeKm(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                  min="0.1" step="0.5"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                  المسافة بين جهات العمل (كم)
                </label>
                <input
                  type="number"
                  value={proximityWorkKm}
                  onChange={(e) => setProximityWorkKm(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                  min="0.1" step="0.5"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black" style={{ color: "var(--text-sub)" }}>
                  فارق وقت الدوام (دقيقة)
                </label>
                <input
                  type="number"
                  value={proximityTimeMinutes}
                  onChange={(e) => setProximityTimeMinutes(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                  min="1" step="5"
                />
              </div>
            </div>
          </div>

          {/* ── Pricing Preview ── */}
          {config && (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Clock size={18} style={{ color: "var(--status-active-text)" }} />
                </div>
                <div>
                  <p className="font-black text-white">مثال على التسعير الحالي</p>
                  <p className="text-xs" style={{ color: "var(--text-hint)" }}>ذهاب فقط، 5 أيام/أسبوع</p>
                </div>
              </div>
              <div className="p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <th className="pb-2 font-black text-right" style={{ color: "var(--text-muted)" }}>النطاق (كم)</th>
                        {[1, 2, 3, 4].map((p) => (
                          <th key={p} className="pb-2 font-black text-center" style={{ color: "var(--text-muted)" }}>{p} شخص</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.sort((a, b) => a.max - b.max).map((tier, i) => {
                        const prevMax = i === 0 ? 0 : (tiers.sort((a, b) => a.max - b.max)[i - 1]?.max ?? 0);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td className="py-2 font-bold text-white">{prevMax}–{tier.max}</td>
                            {[1, 2, 3, 4].map((people) => {
                              const factor = discounts
                                .sort((a, b) => a.people - b.people)
                                .reduce((f, d) => people >= d.people ? d.factor : f, 1.0);
                              const price = Math.round(tier.base * 1.0 * 1.0 * factor);
                              return (
                                <td key={people} className="py-2 text-center font-bold" style={{ color: "var(--brand)" }}>
                                  {price.toLocaleString("ar-SA")}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Admin Review Requests ── */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
              <AlertTriangle size={18} style={{ color: "var(--status-cancelled-text)" }} />
            </div>
            <div className="flex-1">
              <p className="font-black text-white">طلبات تحتاج مراجعة الإدارة</p>
              <p className="text-xs" style={{ color: "var(--text-hint)" }}>طلبات تتجاوز المسافة 40 كم — يجب تحديد السعر يدوياً</p>
            </div>
            {reviewRequests.length > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" }}>
                {reviewRequests.length} طلب
              </span>
            )}
          </div>

          {loadingReview ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin mx-auto" style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
            </div>
          ) : reviewRequests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-bold" style={{ color: "var(--text-muted)" }}>لا توجد طلبات تحتاج مراجعة</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {reviewRequests.map((r) => (
                <div key={r.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" }}>
                          طلب #{r.id}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          {r.distanceKm ? `${r.distanceKm.toFixed(1)} كم` : "—"} · {r.numberOfPeople} أشخاص
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white truncate">من: {r.homeLocation}</p>
                      <p className="text-sm font-bold text-white truncate">إلى: {r.workLocation}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        وقت الذهاب: {r.morningTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="السعر الشهري (ريال)"
                      value={customPrices[r.id] ?? ""}
                      onChange={(e) => setCustomPrices((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
                      style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                      min="0"
                    />
                    <button
                      onClick={() => handleSetReviewPrice(r.id)}
                      disabled={settingPrice === r.id}
                      className="px-4 py-3 rounded-xl font-black text-sm disabled:opacity-50 active:scale-95 transition-transform"
                      style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                    >
                      {settingPrice === r.id ? "..." : "تحديد السعر"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
