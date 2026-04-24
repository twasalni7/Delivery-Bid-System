import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { MessageCircle } from "lucide-react";
import { formatTime12h } from "@/lib/time-utils";

import { API_ORIGIN as API } from "@/lib/api-config";

const STATUS_PILL: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  SELECTED: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح", SELECTED: "تم الاختيار", ACTIVE: "نشط", COMPLETED: "مكتمل",
};

type DriverRequest = {
  id: number; homeLocation: string; workLocation: string;
  morningTime: string; eveningTime: string | null;
  numberOfPeople: number; workingDaysPerWeek: number;
  status: string; phone: string | null; createdAt: string;
};

export default function DriverRequests() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "current" | "past">("all");

  useEffect(() => { if (!user) setLocation("/driver/login"); }, [user, setLocation]);

  const { data: requests, isLoading } = useQuery<DriverRequest[]>({
    queryKey: ["driver-me-requests"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/drivers/me/requests`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل جلب البيانات");
      return res.json();
    },
    enabled: !!user,
  });

  if (!user) return null;

  const filtered = (requests ?? []).filter((r) => {
    if (filter === "current") return r.status === "ACTIVE" || r.status === "SELECTED";
    if (filter === "past") return r.status === "COMPLETED";
    return true;
  });

  return (
    <Layout role="driver">
      <div dir="rtl">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">اتفاقياتي</h1>
          <p className="text-gray-400 text-sm">الطلبات التي تم اختيارك فيها</p>
        </div>

        <div className="flex gap-2 mb-5">
          {([["all", "الكل"], ["current", "الحالية"], ["past", "السابقة"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                filter === f ? "text-white border-green-600" : "bg-white border-gray-200 text-gray-500"
              }`}
              style={filter === f ? { background: "linear-gradient(135deg, #10B981, #059669)" } : {}}>
              {label}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-bold text-gray-500">لا توجد اتفاقيات</p>
            <p className="text-sm text-gray-400 mt-1">لم يتم اختيارك في أي طلب بعد</p>
            <Link href="/driver/dashboard"
              className="mt-4 inline-block px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600">
              العودة للوحة السائق
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 font-mono">#{r.id}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${STATUS_PILL[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <div className="px-4 pb-3 space-y-1.5 text-sm text-gray-500">
                <div>📍 {r.homeLocation} ← {r.workLocation}</div>
                <div dir="ltr">⏰ {formatTime12h(r.morningTime)}{r.eveningTime ? ` – ${formatTime12h(r.eveningTime)}` : ""}</div>
                <div>👥 {r.numberOfPeople} أشخاص · {r.workingDaysPerWeek} أيام/أسبوع</div>
                <p className="text-xs text-gray-300">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</p>
              </div>
              {r.phone && (
                <div className="px-4 pb-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <a href={`tel:${r.phone}`} className="font-bold text-sm text-green-700" dir="ltr">{r.phone}</a>
                  <a href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                    <MessageCircle size={13} /> واتساب العميل
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
