import { Link } from "wouter";
import { Navigation } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-5" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] mb-5 shadow-2xl rotate-[-3deg]"
          style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
          <Navigation size={36} strokeWidth={3} className="text-white" />
        </div>
        <h1 className="text-[2.2rem] font-black text-[#0F172A] tracking-tighter italic leading-none">توصّلني</h1>
        <p className="text-slate-400 font-bold text-sm mt-2">نظام اشتراكات التوصيل الشهري</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Client */}
        <Link href="/client/login">
          <div className="p-6 rounded-[2.5rem] cursor-pointer shadow-2xl shadow-indigo-900/20 active:scale-[0.98] transition-transform border-2 border-indigo-50"
            style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                📦
              </div>
              <div className="text-white flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">عميل</p>
                <p className="text-sm font-bold opacity-80 mt-0.5">Customer</p>
                <p className="text-xs opacity-65 mt-1">اطلب توصيلاً واستعرض عروض السائقين</p>
              </div>
              <div className="text-white/50 text-2xl">›</div>
            </div>
          </div>
        </Link>

        {/* Driver */}
        <Link href="/driver/login">
          <div className="p-6 rounded-[2.5rem] cursor-pointer shadow-2xl shadow-emerald-900/15 active:scale-[0.98] transition-transform border-2 border-emerald-50"
            style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" }}>
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                🚗
              </div>
              <div className="text-white flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none">سائق</p>
                <p className="text-sm font-bold opacity-80 mt-0.5">Driver</p>
                <p className="text-xs opacity-65 mt-1">استلم طلبات وقدّم عروضك</p>
              </div>
              <div className="text-white/50 text-2xl">›</div>
            </div>
          </div>
        </Link>

        {/* Admin */}
        <Link href="/admin/login">
          <div className="p-6 rounded-[2.5rem] cursor-pointer shadow-xl active:scale-[0.98] transition-transform border-2 border-slate-100 bg-white">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #312E81 0%, #6D28D9 100%)" }}>
                🛡️
              </div>
              <div className="flex-1">
                <p className="text-[1.5rem] font-black tracking-tight leading-none text-[#0F172A]">إدارة</p>
                <p className="text-sm font-bold text-slate-400 mt-0.5">Admin</p>
                <p className="text-xs text-slate-400 mt-1">إدارة النظام والمستخدمين</p>
              </div>
              <div className="text-slate-300 text-2xl">›</div>
            </div>
          </div>
        </Link>
      </div>

      <p className="text-slate-300 font-bold text-xs mt-10">اختر نوع الحساب للدخول إلى النظام</p>
    </div>
  );
}
