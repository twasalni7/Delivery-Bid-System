import { Link } from "wouter";
import { Navigation } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5" dir="rtl" style={{ fontFamily: "var(--font-arabic)", backgroundColor: "var(--bg)" }}>
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] mb-5 shadow-2xl rotate-[-3deg]"
          style={{ background: "linear-gradient(135deg, var(--brand-hover) 0%, var(--brand) 100%)", boxShadow: "0 24px 60px var(--brand-border)" }}
        >
          <Navigation size={36} strokeWidth={3} style={{ color: "var(--brand-fg)" }} />
        </div>
        <h1 className="text-[2.2rem] font-black tracking-tighter italic leading-none" style={{ color: "var(--brand)" }}>توصّلني</h1>
        <p className="font-bold text-sm mt-2" style={{ color: "var(--text-muted)" }}>نظام اشتراكات التوصيل الشهري</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Client */}
        <Link href="/client/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--brand-border)", boxShadow: "0 24px 48px rgba(0,0,0,0.35)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner" style={{ backgroundColor: "var(--brand-subtle)" }}>
                📦
              </div>
              <div style={{ color: "var(--text)" }} className="flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">عميل</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "var(--brand)" }}>Customer</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-sub)" }}>اطلب توصيلاً واستعرض عروض السائقين</p>
              </div>
              <div className="text-2xl" style={{ color: "var(--brand)" }}>‹</div>
            </div>
          </div>
        </Link>

        {/* Driver */}
        <Link href="/driver/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--status-active-border)", boxShadow: "var(--shadow-md)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner" style={{ backgroundColor: "var(--status-active-bg)" }}>
                🚗
              </div>
              <div style={{ color: "var(--text)" }} className="flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">سائق</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "var(--status-active-text)" }}>Driver</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-sub)" }}>استلم طلبات وقدّم عروضك</p>
              </div>
              <div className="text-2xl" style={{ color: "var(--status-active-text)" }}>‹</div>
            </div>
          </div>
        </Link>

        {/* Admin */}
        <Link href="/admin/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", boxShadow: "0 24px 48px rgba(0,0,0,0.35)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                style={{ backgroundColor: "var(--surface-3)" }}>
                🛡️
              </div>
              <div className="flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none" style={{ color: "var(--text)" }}>إدارة</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-sub)" }}>Admin</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>إدارة النظام والمستخدمين</p>
              </div>
              <div className="text-2xl" style={{ color: "var(--text-hint)" }}>‹</div>
            </div>
          </div>
        </Link>
      </div>

      <p className="font-bold text-xs mt-10" style={{ color: "var(--text-hint)" }}>اختر نوع الحساب للدخول إلى النظام</p>
    </div>
  );
}
