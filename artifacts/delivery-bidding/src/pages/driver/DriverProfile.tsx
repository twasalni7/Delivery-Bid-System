import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetDriverMe, getGetDriverMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";

export default function DriverProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver, isLoading } = useGetDriverMe({
    query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user },
  });

  useEffect(() => { if (!user) setLocation("/driver/login"); }, [user, setLocation]);

  if (!user) return null;

  if (isLoading) {
    return <Layout role="driver"><div className="text-center py-16 text-gray-400">جاري التحميل...</div></Layout>;
  }

  return (
    <Layout role="driver">
      <div dir="rtl" className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">ملفي الشخصي</h1>
          <p className="text-gray-400 text-sm">بياناتك المسجّلة في المنصة</p>
        </div>

        {driver && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-3xl">🚗</div>
                <div>
                  <p className="font-black text-xl text-gray-900">{driver.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      driver.status === "ACTIVE" ? "bg-green-100 text-green-700"
                      : driver.status === "BLOCKED" ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                    }`}>
                      {driver.status === "ACTIVE" ? "نشط" : driver.status === "BLOCKED" ? "محظور" : driver.status}
                    </span>
                    {driver.balance < 50 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                        رصيد غير كافٍ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <InfoRow emoji="📱" label="رقم الجوال" value={driver.mobile ?? "—"} ltr />
                <InfoRow
                  emoji="💰"
                  label="الرصيد"
                  value={`${driver.balance?.toFixed(2)} ريال`}
                  highlight={driver.balance < 50}
                />
                {driver.carType && <InfoRow emoji="🚗" label="نوع السيارة" value={driver.carType} />}
                {driver.nationality && <InfoRow emoji="🌐" label="الجنسية" value={driver.nationality} />}
                {driver.age && <InfoRow emoji="🎂" label="العمر" value={`${driver.age} سنة`} />}
                {driver.nationalId && <InfoRow emoji="🪪" label="رقم الهوية" value={driver.nationalId} ltr />}
                {driver.warningCount !== undefined && driver.warningCount > 0 && (
                  <InfoRow emoji="⚠️" label="التحذيرات" value={`${driver.warningCount} تحذير`} highlight />
                )}
                <InfoRow
                  emoji="📅"
                  label="تاريخ التسجيل"
                  value={driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("ar-SA") : "—"}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-400 mb-1">🔑 رمز تسجيل الدخول</p>
              <p className="text-xs text-gray-400">يُدار بواسطة الإدارة — تواصل معهم لتغيير رمزك</p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function InfoRow({ emoji, label, value, ltr, highlight }: { emoji: string; label: string; value: string; ltr?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-400">
        <span>{emoji}</span>
        {label}
      </span>
      <span className={`font-bold text-sm ${highlight ? "text-red-500" : "text-gray-800"}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
