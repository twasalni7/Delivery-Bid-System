import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Users, Phone, MessageCircle } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوح",
  SELECTED: "تم الاختيار",
  ACTIVE: "نشط",
  COMPLETED: "مكتمل",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

type DriverRequest = {
  id: number;
  homeLocation: string;
  workLocation: string;
  morningTime: string;
  eveningTime: string;
  numberOfPeople: number;
  workingDaysPerWeek: number;
  status: string;
  phone: string | null;
  createdAt: string;
};

export default function DriverRequests() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "current" | "past">("all");

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

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
        <div className="mb-6">
          <h1 className="text-2xl font-black">اتفاقياتي</h1>
          <p className="text-muted-foreground text-sm mt-0.5">الطلبات التي تم اختيارك فيها</p>
        </div>

        <div className="flex gap-2 mb-5">
          {(["all", "current", "past"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="font-bold text-xs"
            >
              {f === "all" ? "الكل" : f === "current" ? "الحالية" : "السابقة"}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed rounded-md">
            <p className="text-lg font-bold">لا توجد اتفاقيات</p>
            <p className="text-muted-foreground text-sm mt-1">لم يتم اختيارك في أي طلب بعد</p>
            <Button asChild className="mt-4 font-bold" variant="outline">
              <Link href="/driver/dashboard">العودة للوحة السائق</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {filtered.map((r) => (
            <Card key={r.id} className="border-2">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs text-muted-foreground font-mono">#{r.id}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold ${STATUS_COLORS[r.status] ?? ""}`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin size={13} className="text-primary shrink-0" />
                    <span>{r.homeLocation} ← {r.workLocation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={13} className="text-primary shrink-0" />
                    <span dir="ltr">{r.morningTime} – {r.eveningTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users size={13} className="text-primary shrink-0" />
                    <span>{r.numberOfPeople} أشخاص • {r.workingDaysPerWeek} أيام/أسبوع</span>
                  </div>
                  {r.phone && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Phone size={13} className="text-green-600 shrink-0" />
                      <a
                        href={`tel:${r.phone}`}
                        className="font-bold text-green-700"
                        dir="ltr"
                      >
                        {r.phone}
                      </a>
                      <a
                        href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-auto"
                      >
                        <Button size="sm" variant="outline" className="font-bold text-green-700 border-green-300 hover:bg-green-50 gap-1 text-xs">
                          <MessageCircle size={13} />
                          واتساب العميل
                        </Button>
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
