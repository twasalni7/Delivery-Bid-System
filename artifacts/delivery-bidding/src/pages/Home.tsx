import { Link } from "wouter";
import { Navigation, ShieldCheck, Wallet, ArrowLeft } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-10" dir="rtl" style={{ fontFamily: "var(--font-arabic)" }}>
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-b from-violet-700 to-violet-900 text-white pt-12 pb-16 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
          <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-violet-600 rounded-full opacity-50 blur-2xl" />
          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-md">
              <Navigation className="text-violet-700 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold mb-3">توصلني</h1>
            <p className="text-violet-100 text-lg leading-relaxed max-w-xs">مشاويرك الشهرية بأمان، سهولة، وبتسعيرة ثابتة.</p>
          </div>
        </div>

        <div className="px-6 -mt-8 relative z-20 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shrink-0"><ShieldCheck size={18} /></div>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">خصوصية تامة</h3>
              <p className="text-sm text-slate-500 leading-relaxed">رقمك مخفي تماماً. أنتِ من يختار السائق المناسب.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 shrink-0"><Wallet size={18} /></div>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">سعر ثابت، الدفع لاحقاً</h3>
              <p className="text-sm text-slate-500 leading-relaxed">تسعيرة عادلة. الدفع يكون مع السائق بعد تقديم الخدمة.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link href="/client/login" className="w-full bg-violet-700 hover:bg-violet-800 hover:shadow-2xl active:scale-[0.99] text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-violet-200 transition-all flex justify-center items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              <span>دخول العميل</span><ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/driver/login" aria-label="الانتقال إلى دخول السائق">
                <div className="rounded-2xl p-3.5 text-center font-black text-sm bg-white border border-slate-200 text-slate-700">دخول السائق</div>
              </Link>
              <Link href="/admin/login" aria-label="الانتقال إلى دخول الإدارة">
                <div className="rounded-2xl p-3.5 text-center font-black text-sm bg-white border border-slate-200 text-slate-700">دخول الإدارة</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
