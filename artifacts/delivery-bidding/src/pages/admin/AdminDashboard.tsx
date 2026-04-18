import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminStats, useGetAdminAnalytics, useGetAdminFinancial } from "@workspace/api-client-react";
import type { AdminAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Download, Banknote, Wallet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const PIE_COLORS = ["#8B5CF6", "#e5e7eb"];
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
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
function exportAnalyticsCSV(analytics: AdminAnalytics) {
  const sections: string[] = [];
  sections.push("الطلبات الشهرية\nالشهر,عدد الطلبات");
  for (const row of analytics.monthlyRequests) sections.push(`${csvEscape(formatMonthLabel(row.year, row.month))},${row.count}`);
  sections.push("\nتوزيع حالة الطلبات\nالفئة,العدد");
  sections.push(`تم الاختيار,${analytics.requestStatusSplit.selected}\nمفتوح,${analytics.requestStatusSplit.open}`);
  sections.push("\nأفضل السائقين\nالاسم,عدد العقود المقبولة");
  for (const d of analytics.topDrivers) sections.push(`${csvEscape(d.name)},${d.acceptedBids}`);
  const blob = new Blob(["\uFEFF" + sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "analytics.csv"; a.click();
  URL.revokeObjectURL(url);
}

const STAT_CARDS = [
  { key: "totalRequests", label: "إجمالي الطلبات", bg: "#8B5CF6" },
  { key: "openRequests", label: "مفتوح", bg: "#3B82F6" },
  { key: "selectedRequests", label: "تم الاختيار", bg: "#F59E0B" },
  { key: "activeRequests", label: "نشط", bg: "#10B981" },
] as const;

export default function AdminDashboard() {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(12);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);

  const analyticsParams = appliedRange
    ? { from: appliedRange.from, to: appliedRange.to }
    : { months: selectedMonths };

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: analytics, isLoading: analyticsLoading, isFetching: analyticsFetching } = useGetAdminAnalytics(analyticsParams);
  const { data: financial, isLoading: financialLoading } = useGetAdminFinancial();
  const isLoading = statsLoading || analyticsLoading || financialLoading;

  function handleMonthSelect(value: 3 | 6 | 12) {
    setSelectedMonths(value);
    setAppliedRange(null);
    setFromDate("");
    setToDate("");
  }

  function handleApplyCustomRange() {
    if (fromDate && toDate) {
      setAppliedRange({ from: fromDate, to: toDate });
    }
  }

  function handleClearCustomRange() {
    setFromDate("");
    setToDate("");
    setAppliedRange(null);
  }

  const monthlyChartData = analytics?.monthlyRequests.map((r) => ({
    label: formatMonthLabel(r.year, r.month),
    count: r.count,
  })) ?? [];

  const pieData = analytics
    ? [{ name: "تم الاختيار", value: analytics.requestStatusSplit.selected }, { name: "مفتوح", value: analytics.requestStatusSplit.open }]
    : [];

  const totalRequests = analytics ? analytics.requestStatusSplit.selected + analytics.requestStatusSplit.open : 0;
  const selectionRate = totalRequests > 0 ? Math.round((analytics!.requestStatusSplit.selected / totalRequests) * 100) : 0;

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">لوحة الإدارة</h1>
            <p className="text-gray-400 text-sm">نظرة عامة على المنصة والإحصائيات</p>
          </div>
          {analytics && (
            <button
              onClick={() => exportAnalyticsCSV(analytics)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 shadow-sm hover:border-violet-400 transition-colors"
            >
              <Download size={15} /> تصدير CSV
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {STAT_CARDS.map((s) => (
                <div key={s.key} className="rounded-2xl p-4 text-white shadow-md" style={{ background: s.bg }}>
                  <p className="text-white/70 text-xs font-bold mb-1">{s.label}</p>
                  <p className="text-3xl font-black">{stats[s.key]}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-gray-400 text-xs font-bold mb-1">مكتمل</p>
                <p className="text-2xl font-black text-gray-500">{stats.completedRequests}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-gray-400 text-xs font-bold mb-1">السائقون</p>
                <p className="text-2xl font-black text-gray-800">{stats.totalDrivers}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-gray-400 text-xs font-bold mb-1">العروض</p>
                <p className="text-2xl font-black text-gray-800">{stats.totalOffers}</p>
              </div>
            </div>
          </>
        )}

        {financial && (
          <div className="mb-5">
            <h2 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2">
              <Banknote size={16} /> الإحصائيات المالية
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-500 rounded-2xl p-4 text-white shadow-md">
                <p className="text-white/70 text-xs font-bold mb-1 flex items-center gap-1">
                  <Banknote size={12} /> إجمالي الرسوم المحصّلة
                </p>
                <p className="text-3xl font-black">{financial.totalFeesCollected.toLocaleString("ar-SA")} ريال</p>
                <p className="text-white/60 text-xs mt-1">{financial.acceptedContractsCount} عقد × 50 ريال</p>
              </div>
              <div className="bg-violet-500 rounded-2xl p-4 text-white shadow-md">
                <p className="text-white/70 text-xs font-bold mb-1 flex items-center gap-1">
                  <Wallet size={12} /> إجمالي أرصدة السائقين
                </p>
                <p className="text-3xl font-black">{financial.totalDriversBalance.toLocaleString("ar-SA")} ريال</p>
                <p className="text-white/60 text-xs mt-1">مجموع أرصدة {financial.driverBalances.length} سائق</p>
              </div>
              {financial.totalTransactionsAmount > 0 && (
                <div className="bg-blue-500 rounded-2xl p-4 text-white shadow-md">
                  <p className="text-white/70 text-xs font-bold mb-1">إجمالي المعاملات المالية</p>
                  <p className="text-3xl font-black">{financial.totalTransactionsAmount.toLocaleString("ar-SA")} ريال</p>
                  <p className="text-white/60 text-xs mt-1">من جدول المعاملات</p>
                </div>
              )}
            </div>
            {financial.driverBalances.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
                <p className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <Wallet size={14} /> توزيع أرصدة السائقين
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-400 text-xs">
                        <th className="text-right py-2 px-2 font-semibold">#</th>
                        <th className="text-right py-2 px-2 font-semibold">السائق</th>
                        <th className="text-right py-2 px-2 font-semibold">الرصيد (ريال)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financial.driverBalances.map((driver, index) => (
                        <tr key={driver.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-2 text-gray-400">{index + 1}</td>
                          <td className="py-2 px-2 font-bold text-gray-800">{driver.name}</td>
                          <td className="py-2 px-2">
                            <span className={`font-black ${driver.balance > 0 ? "text-emerald-600" : driver.balance < 0 ? "text-red-600" : "text-gray-400"}`}>
                              {driver.balance.toLocaleString("ar-SA")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-black text-gray-800">الرسوم البيانية</h2>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {MONTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleMonthSelect(opt.value)}
                  disabled={analyticsFetching}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedMonths === opt.value && !appliedRange
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-gray-500"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
            <span className="text-xs font-bold text-gray-500 shrink-0">نطاق مخصص:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors ${
                appliedRange ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white"
              }`}
            />
            <span className="text-xs text-gray-400">—</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors ${
                appliedRange ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white"
              }`}
            />
            <button
              onClick={handleApplyCustomRange}
              disabled={!fromDate || !toDate}
              className="text-xs font-bold px-3 py-1 rounded-lg bg-violet-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-700 transition-colors"
            >
              تطبيق
            </button>
            {appliedRange && (
              <button
                onClick={handleClearCustomRange}
                className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {(analytics || analyticsFetching) && (
          <div className="relative">
            {analyticsFetching && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 rounded-2xl gap-3">
                <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <span className="text-xs font-bold text-gray-400">جاري التحميل...</span>
              </div>
            )}
          <div className={analyticsFetching ? "opacity-40 pointer-events-none select-none" : ""}>
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm lg:col-span-2">
                <p className="text-sm font-black text-gray-800 mb-3">حجم الطلبات الشهري</p>
                {monthlyChartData.length === 0
                  ? <div className="h-48 flex items-center justify-center text-gray-300 text-sm">لا توجد بيانات</div>
                  : <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={monthlyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip formatter={(value: number) => [value, "طلب"]} contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-sm font-black text-gray-800 mb-2">توزيع الحالات</p>
                {totalRequests === 0
                  ? <div className="h-48 flex items-center justify-center text-gray-300 text-sm">لا توجد بيانات</div>
                  : <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                            {pieData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                          <Tooltip formatter={(v: number) => [v, "طلب"]} contentStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <p className="text-center text-xs text-gray-400 mt-1">
                        نسبة الاختيار: <span className="font-black text-violet-600">{selectionRate}%</span>
                      </p>
                    </>
                }
              </div>
            </div>

            {(analytics?.topDrivers.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
                <p className="text-sm font-black text-gray-800 mb-3">🏆 أفضل السائقين</p>
                <div className="space-y-2">
                  {analytics?.topDrivers.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                      <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="flex-1 font-bold text-sm text-gray-800">{d.name}</span>
                      <span className="text-sm font-black text-green-600">{d.acceptedBids} عقد</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
          </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/admin/requests", emoji: "📋", label: "الطلبات" },
            { href: "/admin/drivers", emoji: "🚗", label: "السائقون" },
            { href: "/admin/clients", emoji: "👤", label: "العملاء" },
            { href: "/admin/offers", emoji: "💰", label: "العروض" },
            { href: "/admin/support", emoji: "🎫", label: "الدعم" },
            { href: "/admin/settings", emoji: "⚙️", label: "الإعدادات" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-2 hover:border-violet-300 hover:shadow-md transition-all active:scale-[0.97]"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-sm font-black text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
