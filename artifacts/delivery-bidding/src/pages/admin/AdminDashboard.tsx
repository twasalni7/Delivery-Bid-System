import { Link } from "wouter";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, TrendingUp, UserCheck, Settings } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  return (
    <Layout role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-black">لوحة الإدارة</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على المنصة والإحصائيات</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">إجمالي الطلبات</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-blue-600">مفتوح</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-blue-700">{stats.openRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-amber-600">تم الاختيار</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-amber-700">{stats.selectedRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-green-600">نشط</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-green-700">{stats.activeRequests}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-2 bg-muted/20">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">مكتمل</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-muted-foreground">{stats.completedRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Users size={12} /> إجمالي السائقين
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalDrivers}</p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={12} /> إجمالي العروض
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalOffers}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/requests">
            <Package size={20} className="mb-1" />
            إدارة الطلبات
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/drivers">
            <Users size={20} className="mb-1" />
            إدارة السائقين
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/clients">
            <UserCheck size={20} className="mb-1" />
            إدارة العملاء
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/offers">
            <FileText size={20} className="mb-1" />
            عرض كل العروض
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/settings">
            <Settings size={20} className="mb-1" />
            الإعدادات
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/offers">
            <TrendingUp size={20} className="mb-1" />
            إحصائيات العروض
          </Link>
        </Button>
      </div>
    </Layout>
  );
}
