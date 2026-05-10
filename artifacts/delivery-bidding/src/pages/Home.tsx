import { Link } from "wouter";
import { Navigation, ShieldCheck, Wallet, ArrowLeft } from "lucide-react";

export default function Home() {
  return (
    <div
      className="min-h-screen text-slate-100 pb-10 px-4 sm:px-6"
      dir="rtl"
      style={{ fontFamily: "var(--font-arabic)", background: "linear-gradient(180deg, #12151f 0%, #181c27 45%, #10131b 100%)" }}
    >
      <div className="max-w-md mx-auto pt-10">
        <div
          className="text-white pt-10 pb-12 px-6 rounded-[2.25rem] shadow-2xl relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7b2cff 0%, #6126c9 58%, #4f1da7 100%)" }}
        >
          <div className="absolute top-[-72px] left-[-72px] w-44 h-44 rounded-full opacity-25 blur-3xl bg-fuchsia-400" />
          <div className="absolute bottom-[-86px] right-[-64px] w-52 h-52 rounded-full opacity-25 blur-3xl bg-violet-300" />
          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-[#0b0f16] rounded-3xl flex items-center justify-center mb-6 shadow-xl">
              <Navigation className="text-fuchsia-300 w-10 h-10" />
            </div>
            <h1 className="text-5xl font-black mb-4">توصّلني</h1>
            <p className="text-violet-100/95 text-[1.35rem] leading-relaxed max-w-xs">
              مشاويرك الشهرية بأمان، بسهولة، وتسعيرة ثابتة بدون مفاجآت.
            </p>
          </div>
        </div>

        <div className="px-4 -mt-10 relative z-20 space-y-4">
          <div className="rounded-3xl p-5 shadow-xl border border-white/10 flex items-start gap-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(10, 13, 20, 0.9)" }}>
            <div className="bg-emerald-900/60 p-3 rounded-2xl text-emerald-300 shrink-0"><ShieldCheck size={18} /></div>
            <div>
              <h3 className="font-black text-white mb-1">خصوصية تامة</h3>
              <p className="text-sm text-slate-300 leading-relaxed">رقمك مخفي تماماً. أنت تختارين/تختار السائق المناسب.</p>
            </div>
          </div>

          <div className="rounded-3xl p-5 shadow-xl border border-white/10 flex items-start gap-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(10, 13, 20, 0.9)" }}>
            <div className="bg-blue-900/60 p-3 rounded-2xl text-blue-300 shrink-0"><Wallet size={18} /></div>
            <div>
              <h3 className="font-black text-white mb-1">سعر ثابت، الدفع لاحقاً</h3>
              <p className="text-sm text-slate-300 leading-relaxed">لا تدفعين شيء بالتطبيق. الدفع مع السائق بعد تقديم الخدمة.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link href="/client/login" className="w-full bg-violet-700 hover:bg-violet-600 active:scale-[0.99] text-white font-black text-[2rem] py-4 rounded-[1.6rem] shadow-2xl shadow-violet-950/80 transition-all flex justify-center items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              <span>دخول العميل</span><ArrowLeft size={28} aria-hidden="true" />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/driver/login" aria-label="الانتقال إلى دخول السائق">
                <div className="rounded-2xl p-3.5 text-center font-black text-sm bg-white/5 border border-white/10 text-slate-200">دخول السائق</div>
              </Link>
              <Link href="/admin/login" aria-label="الانتقال إلى دخول الإدارة">
                <div className="rounded-2xl p-3.5 text-center font-black text-sm bg-white/5 border border-white/10 text-slate-200">دخول الإدارة</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
