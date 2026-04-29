import { Link } from "wouter";
import { Navigation } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: "#000000" }}>
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] mb-5 shadow-2xl rotate-[-3deg]"
          style={{ background: "linear-gradient(135deg, #c8f070 0%, #deff9a 100%)", boxShadow: "0 24px 60px rgba(222,255,154,0.18)" }}
        >
          <Navigation size={36} strokeWidth={3} style={{ color: "#0a0a0a" }} />
        </div>
        <h1 className="text-[2.2rem] font-black tracking-tighter italic leading-none" style={{ color: "#deff9a" }}>توصّلني</h1>
        <p className="font-bold text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>نظام اشتراكات التوصيل الشهري</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Client */}
        <Link href="/client/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "#111111", borderColor: "rgba(222,255,154,0.16)", boxShadow: "0 24px 48px rgba(0,0,0,0.35)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner" style={{ backgroundColor: "rgba(222,255,154,0.12)" }}>
                📦
              </div>
              <div className="text-white flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">عميل</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "#deff9a" }}>Customer</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>اطلب توصيلاً واستعرض عروض السائقين</p>
              </div>
              <div className="text-2xl" style={{ color: "rgba(222,255,154,0.7)" }}>‹</div>
            </div>
          </div>
        </Link>

        {/* Driver */}
        <Link href="/driver/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "#111111", borderColor: "rgba(52,211,153,0.18)", boxShadow: "0 24px 48px rgba(0,0,0,0.35)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner" style={{ backgroundColor: "rgba(16,185,129,0.12)" }}>
                🚗
              </div>
              <div className="text-white flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">سائق</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "#34d399" }}>Driver</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>استلم طلبات وقدّم عروضك</p>
              </div>
              <div className="text-2xl" style={{ color: "rgba(52,211,153,0.7)" }}>‹</div>
            </div>
          </div>
        </Link>

        {/* Admin */}
        <Link href="/admin/login">
          <div
            className="p-6 rounded-[2.5rem] cursor-pointer active:scale-[0.98] transition-transform border"
            style={{ backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 24px 48px rgba(0,0,0,0.35)" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)" }}>
                🛡️
              </div>
              <div className="flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none text-white">إدارة</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Admin</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>إدارة النظام والمستخدمين</p>
              </div>
              <div className="text-2xl" style={{ color: "rgba(255,255,255,0.35)" }}>‹</div>
            </div>
          </div>
        </Link>
      </div>

      <p className="font-bold text-xs mt-10" style={{ color: "rgba(255,255,255,0.35)" }}>اختر نوع الحساب للدخول إلى النظام</p>
    </div>
  );
}
