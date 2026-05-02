import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { MapPin, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";

type ServiceArea = {
  id: number;
  city: string;
  district: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
};

export default function AdminServiceAreas() {
  const { toast } = useToast();

  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add form
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/service-areas/all`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التحميل");
      if (Array.isArray(data)) setAreas(data);
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAreas(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) { toast({ title: "اسم المدينة مطلوب", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/service-areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          city: city.trim(),
          district: district.trim() || null,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الإضافة");
      toast({ title: "✅ تمت إضافة المنطقة" });
      setCity(""); setDistrict(""); setLat(""); setLng("");
      await fetchAreas();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (area: ServiceArea) => {
    try {
      const res = await fetch(`${API}/api/service-areas/${area.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isActive: !area.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل التحديث");
      setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, isActive: !area.isActive } : a)));
      toast({ title: area.isActive ? "تم إيقاف المنطقة" : "✅ تم تفعيل المنطقة" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (area: ServiceArea) => {
    if (!confirm(`هل تريد حذف "${area.city}${area.district ? ` - ${area.district}` : ""}"؟`)) return;
    try {
      const res = await fetch(`${API}/api/service-areas/${area.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الحذف");
      setAreas((prev) => prev.filter((a) => a.id !== area.id));
      toast({ title: "تم حذف المنطقة" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  // Group by city
  const grouped = areas.reduce<Record<string, ServiceArea[]>>((acc, a) => {
    if (!acc[a.city]) acc[a.city] = [];
    acc[a.city]!.push(a);
    return acc;
  }, {});

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(52,211,153,0.15)" }}>
              <MapPin size={20} style={{ color: "#34d399" }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">مناطق الخدمة</h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>المدن والأحياء المخدومة في المنطقة الشرقية</p>
            </div>
          </div>
          <button
            onClick={fetchAreas}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="p-5 rounded-[1.5rem] space-y-4"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm font-bold text-white">إضافة منطقة جديدة</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="المدينة *"
              className="px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-white/30"
              dir="rtl"
            />
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="الحي (اختياري)"
              className="px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-white/30"
              dir="rtl"
            />
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="خط العرض (lat)"
              className="px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-white/30"
              dir="ltr"
            />
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="خط الطول (lng)"
              className="px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none placeholder:text-white/30"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: "#deff9a", color: "#000" }}
          >
            <Plus size={16} />
            {saving ? "جاري الإضافة..." : "إضافة"}
          </button>
        </form>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي المناطق", value: areas.length, color: "#60a5fa" },
            { label: "مفعّلة", value: areas.filter((a) => a.isActive).length, color: "#34d399" },
            { label: "موقوفة", value: areas.filter((a) => !a.isActive).length, color: "#f87171" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-[1.5rem] text-center" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Areas list grouped by city */}
        {loading ? (
          <div className="p-12 text-center text-white/40 text-sm">جاري التحميل...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="p-12 text-center text-white/40 text-sm">لا توجد مناطق مضافة</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cityName, cityAreas]) => (
              <div key={cityName} className="rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <MapPin size={16} style={{ color: "#34d399" }} />
                  <span className="font-black text-white">{cityName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    {cityAreas.length} منطقة
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {cityAreas.map((area) => (
                    <div key={area.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white">{area.district ?? `${cityName} (المدينة)`}</p>
                        {area.lat != null && area.lng != null && (
                          <p className="text-xs font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleActive(area)}
                          title={area.isActive ? "إيقاف" : "تفعيل"}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                        >
                          {area.isActive
                            ? <ToggleRight size={20} style={{ color: "#34d399" }} />
                            : <ToggleLeft size={20} style={{ color: "rgba(255,255,255,0.3)" }} />}
                        </button>
                        <button
                          onClick={() => handleDelete(area)}
                          title="حذف"
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 size={16} style={{ color: "#f87171" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
