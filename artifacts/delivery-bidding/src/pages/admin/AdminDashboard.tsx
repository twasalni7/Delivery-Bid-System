import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminStats, useGetAdminAnalytics, useGetAdminFinancial } from "@workspace/api-client-react";
import type { AdminAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AdminPageTabs } from "@/components/admin-page-tabs";
import { EnablePushButton } from "@/components/enable-push-button";
import { Download, Banknote, Wallet } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const PIE_COLORS = ["var(--brand)", "var(--brand-subtle)", "var(--status-active-bg)", "var(--surface-3)"];
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
  { key: "totalRequests", label: "إجمالي الطلبات", bg: "var(--brand)" },
  { key: "openRequests", label: "مفتوح", bg: "var(--status-frozen-text)" },
  { key: "selectedRequests", label: "تم الاختيار", bg: "var(--status-open-text)" },
  { key: "activeRequests", label: "نشط", bg: "var(--status-active-text)" },
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
        <AdminPageTabs
          tabs={[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/operations", label: "Operations" },
          ]}
        />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black">لوحة الإدارة</h1>
            <p className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>نظرة عامة على المنصة والإحصائيات</p>
          </div>
          {analytics && (
            <button
              onClick={() => exportAnalyticsCSV(analytics)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors btn-ghost"
            >
              <Download size={15} /> تصدير CSV
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-16 font-bold" style={{ color: "var(--text-muted)" }}>جاري التحميل...</div>}

        {/* ── إشعارات لوحة التحكم ── */}
        <div className="rounded-3xl p-5 mb-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>🔔</div>
            <div>
              <p className="font-black text-base" style={{ color: "var(--text)" }}>إشعارات لوحة التحكم</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>تلقّ تنبيهات فورية عند أي نشاط جديد</p>
            </div>
          </div>
          <EnablePushButton />
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {STAT_CARDS.map((s) => (
                <div key={s.key} className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  <p className="text-3xl font-black" style={{ color: "var(--brand)" }}>{stats[s.key]}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>مكتمل</p>
                <p className="text-2xl font-black" style={{ color: "var(--brand)" }}>{stats.completedRequests}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>السائقون</p>
                <p className="text-2xl font-black">{stats.totalDrivers}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>العروض</p>
                <p className="text-2xl font-black">{stats.totalOffers}</p>
              </div>
            </div>
          </>
        )}

        {financial && (
          <div className="mb-5">
            <h2 className="text-base font-black mb-3 flex items-center gap-2">
              <Banknote size={16} /> الإحصائيات المالية
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Banknote size={12} /> إجمالي الرسوم المحصّلة
                </p>
                <p className="text-3xl font-black" style={{ color: "var(--brand)" }}>{financial.totalFeesCollected.toLocaleString("ar-SA")} ريال</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-hint)" }}>{financial.acceptedContractsCount} عقد × 50 ريال</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Wallet size={12} /> إجمالي أرصدة السائقين
                </p>
                <p className="text-3xl font-black" style={{ color: "var(--brand)" }}>{financial.totalDriversBalance.toLocaleString("ar-SA")} ريال</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-hint)" }}>مجموع أرصدة {financial.driverBalances.length} سائق</p>
              </div>
              {financial.totalTransactionsAmount > 0 && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>إجمالي المعاملات المالية</p>
                  <p className="text-3xl font-black" style={{ color: "var(--brand)" }}>{financial.totalTransactionsAmount.toLocaleString("ar-SA")} ريال</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-hint)" }}>من جدول المعاملات</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-black">الرسوم البيانية</h2>
            <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--border-subtle)" }}>
              {MONTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleMonthSelect(opt.value)}
                  disabled={analyticsFetching}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={selectedMonths === opt.value && !appliedRange
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                    : { color: "var(--text-muted)" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
            <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-muted)" }}>نطاق مخصص:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`input-dark text-xs rounded-lg px-2 py-1 focus:outline-none transition-colors`}
              style={appliedRange ? { borderColor: "var(--brand)" } : {}}
            />
            <span className="text-xs" style={{ color: "var(--text-hint)" }}>—</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className={`input-dark text-xs rounded-lg px-2 py-1 focus:outline-none transition-colors`}
              style={appliedRange ? { borderColor: "var(--brand)" } : {}}
            />
            <button
              onClick={handleApplyCustomRange}
              disabled={!fromDate || !toDate}
              className="text-xs font-bold px-3 py-1 rounded-lg text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: "var(--brand)" }}
            >
              تطبيق
            </button>
            {appliedRange && (
              <button
                onClick={handleClearCustomRange}
                className="text-xs font-bold px-2 py-1 rounded-lg border transition-colors btn-ghost"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {(analytics || analyticsFetching) && (
          <div className="relative">
            {analyticsFetching && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl gap-3" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
                <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "var(--brand-border)", borderTopColor: "var(--brand)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>جاري التحميل...</span>
              </div>
            )}
          <div className={analyticsFetching ? "opacity-40 pointer-events-none select-none" : ""}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <div className="rounded-2xl p-4 lg:col-span-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-sm font-black mb-3">حجم الطلبات الشهري</p>
                {monthlyChartData.length === 0
                  ? <div className="h-48 flex items-center justify-center text-sm" style={{ color: "var(--text-hint)" }}>لا توجد بيانات</div>
                  : <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={monthlyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
                        <Tooltip formatter={(value: number) => [value, "طلب"]} contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-sm font-black mb-2">توزيع الحالات</p>
                {totalRequests === 0
                  ? <div className="h-48 flex items-center justify-center text-sm" style={{ color: "var(--text-hint)" }}>لا توجد بيانات</div>
                  : <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                            {pieData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Legend formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-sub)" }}>{v}</span>} />
                          <Tooltip formatter={(v: number) => [v, "طلب"]} contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <p className="text-center text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        نسبة الاختيار: <span className="font-black" style={{ color: "var(--brand)" }}>{selectionRate}%</span>
                      </p>
                    </>
                }
              </div>
            </div>

            {(analytics?.topDrivers.length ?? 0) > 0 && (
              <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-sm font-black mb-3">🏆 أفضل السائقين</p>
                <div className="space-y-2">
                  {analytics?.topDrivers.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: "var(--border-subtle)" }}>
                      <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 text-black" style={{ backgroundColor: "var(--brand)" }}>{i + 1}</span>
                      <span className="flex-1 font-bold text-sm">{d.name}</span>
                      <span className="text-sm font-black" style={{ color: "var(--brand)" }}>{d.acceptedBids} عقد</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
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
              className="rounded-2xl p-4 flex flex-col items-center gap-2 transition-all active:scale-[0.97]"
             style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-sm font-black">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </Layout>
  );
}
