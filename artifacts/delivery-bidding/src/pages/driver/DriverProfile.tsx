import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetDriverMe, getGetDriverMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Car, Globe, CreditCard, AlertTriangle, Calendar } from "lucide-react";

export default function DriverProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver, isLoading } = useGetDriverMe({
    query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user },
  });

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  if (!user) return null;

  if (isLoading) {
    return (
      <Layout role="driver">
        <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
      </Layout>
    );
  }

  return (
    <Layout role="driver">
      <div dir="rtl" className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black">ملفي الشخصي</h1>
          <p className="text-muted-foreground text-sm mt-0.5">بياناتك المسجّلة في المنصة</p>
        </div>

        {driver && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User size={16} className="text-primary" />
                معلومات الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Row icon={<User size={14} />} label="الاسم" value={driver.name} />
                <Row icon={<Phone size={14} />} label="رقم الجوال" value={driver.mobile ?? "—"} ltr />
                <Row
                  icon={<CreditCard size={14} />}
                  label="الرصيد"
                  value={`${driver.balance?.toFixed(2)} ريال`}
                  highlight={driver.balance < 50}
                />
                {driver.carType && <Row icon={<Car size={14} />} label="نوع السيارة" value={driver.carType} />}
                {driver.nationality && <Row icon={<Globe size={14} />} label="الجنسية" value={driver.nationality} />}
                {driver.age && <Row icon={<User size={14} />} label="العمر" value={`${driver.age} سنة`} />}
                {driver.warningCount !== undefined && driver.warningCount > 0 && (
                  <Row
                    icon={<AlertTriangle size={14} className="text-amber-500" />}
                    label="التحذيرات"
                    value={`${driver.warningCount} تحذير`}
                    highlight
                  />
                )}
                <Row
                  icon={<Calendar size={14} />}
                  label="تاريخ التسجيل"
                  value={driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("ar-SA") : "—"}
                />
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground font-bold mb-1">رمز تسجيل الدخول</p>
                <p className="text-muted-foreground text-xs">يُدار بواسطة الإدارة — تواصل معهم لتغيير رمزك</p>
              </div>

              <div className="pt-2 border-t flex items-center gap-2">
                <Badge
                  className={
                    driver.status === "ACTIVE"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : driver.status === "BLOCKED"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-gray-100 text-gray-700"
                  }
                  variant="outline"
                >
                  {driver.status === "ACTIVE" ? "نشط" : driver.status === "BLOCKED" ? "محظور" : driver.status}
                </Badge>
                {driver.balance < 50 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    رصيد غير كافٍ
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Row({
  icon,
  label,
  value,
  ltr,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {icon} {label}
      </span>
      <span className={`font-bold text-sm ${highlight ? "text-red-600" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
