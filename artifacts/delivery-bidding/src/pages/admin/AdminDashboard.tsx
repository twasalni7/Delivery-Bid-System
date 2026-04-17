import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminStats, useGetAdminAnalytics } from "@workspace/api-client-react";
import type { AdminAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, TrendingUp, UserCheck, Settings, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PIE_COLORS = ["#22c55e", "#e5e7eb"];

const MONTH_OPTIONS = [
  { label: "3 أشهر", value: 3 as const },
  { label: "6 أشهر", value: 6 as const },
  { label: "12 شهراً", value: 12 as const },
];

function formatMonthLabel(year: number, month: number) {
  return `${ARABIC_MONTHS[month - 1]} ${year}`;
}

function csvEscape(value: string | number) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportAnalyticsCSV(analytics: AdminAnalytics) {
  const sections: string[] = [];

  sections.push("الطلبات الشهرية");
  sections.push("الشهر,عدد الطلبات");
  for (const row of analytics.monthlyRequests) {
    sections.push(`${csvEscape(formatMonthLabel(row.year, row.month))},${row.count}`);
  }

  sections.push("");
  sections.push("توزيع حالة الطلبات");
  sections.push("الفئة,العدد");
  sections.push(`تم الاختيار,${analytics.requestStatusSplit.selected}`);
  sections.push(`مفتوح,${analytics.requestStatusSplit.open}`);

  sections.push("");
  sections.push("أفضل السائقين");
  sections.push("الاسم,عدد العقود المقبولة");
  for (const driver of analytics.topDrivers) {
    sections.push(`${csvEscape(driver.name)},${driver.acceptedBids}`);
  }

  const csvContent = "\uFEFF" + sections.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(12);

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: analytics, isLoading: analyticsLoading } = useGetAdminAnalytics(
    { months: selectedMonths }
  );

  const isLoading = statsLoading || analyticsLoading;

  const monthlyChartData = analytics?.monthlyRequests.map((r) => ({
    label: formatMonthLabel(r.year, r.month),
    count: r.count,
  })) ?? [];

  const pieData = analytics
    ? [
        { name: "تم الاختيار", value: analytics.requestStatusSplit.selected },
        { name: "مفتوح", value: analytics.requestStatusSplit.open },
      ]
    : [];

  const totalRequests = analytics
    ? analytics.requestStatusSplit.selected + analytics.requestStatusSplit.open
    : 0;

  const selectionRate = totalRequests > 0
    ? Math.round((analytics!.requestStatusSplit.selected / totalRequests) * 100)
    : 0;

  const selectedMonthLabel = MONTH_OPTIONS.find((o) => o.value === selectedMonths)?.label ?? "";

  return (
    <Layout role="admin">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black">لوحة الإدارة</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة عامة على المنصة والإحصائيات</p>
        </div>
        {analytics && (
          <Button
            variant="outline"
            className="gap-2 border-2"
            onClick={() => exportAnalyticsCSV(analytics)}
          >
            <Download size={16} />
            تصدير CSV
          </Button>
        )}
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

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-base font-bold">الرسوم البيانية</h2>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {MONTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedMonths(opt.value)}
              className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                selectedMonths === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {analytics && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="border-2 lg:col-span-2">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold">
                  حجم الطلبات الشهري (آخر {selectedMonthLabel})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {monthlyChartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    لا توجد بيانات بعد
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number) => [value, "طلب"]}
                        labelStyle={{ fontFamily: "inherit" }}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold">توزيع حالة الطلبات</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {totalRequests === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    لا توجد طلبات بعد
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend
                          formatter={(value) => (
                            <span style={{ fontSize: 12 }}>{value}</span>
                          )}
                        />
                        <Tooltip
                          formatter={(value: number) => [value, "طلب"]}
                          contentStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-center text-sm text-muted-foreground mt-1">
                      نسبة الاختيار: <span className="font-bold text-green-600">{selectionRate}%</span>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {analytics.topDrivers.length > 0 && (
            <Card className="border-2 mb-8">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users size={14} />
                  أفضل السائقين (حسب العقود المقبولة)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {analytics.topDrivers.map((driver, index) => (
                    <div
                      key={driver.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 font-medium text-sm">{driver.name}</span>
                      <span className="text-sm font-bold text-green-600">
                        {driver.acceptedBids} عقد
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
