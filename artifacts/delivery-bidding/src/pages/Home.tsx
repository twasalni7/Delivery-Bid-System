import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-5" dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-3xl shadow-md"
          style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}>
          🚐
        </div>
        <h1 className="text-2xl font-black text-gray-900">توصّلني</h1>
        <p className="text-gray-400 text-sm mt-1">Delivery Bid Management System</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <Link href="/client/login">
          <div className="rounded-2xl p-5 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
                📦
              </div>
              <div className="text-white flex-1">
                <p className="text-xl font-black">عميل</p>
                <p className="text-sm font-bold opacity-90">Customer</p>
                <p className="text-xs opacity-75 mt-0.5">اطلب توصيل واستعرض العروض</p>
                <p className="text-xs opacity-60">Request delivery and view bids</p>
              </div>
              <div className="text-white/60 text-2xl">›</div>
            </div>
          </div>
        </Link>

        <Link href="/driver/login">
          <div className="rounded-2xl p-5 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
                🚗
              </div>
              <div className="text-white flex-1">
                <p className="text-xl font-black">سائق</p>
                <p className="text-sm font-bold opacity-90">Driver</p>
                <p className="text-xs opacity-75 mt-0.5">استلم طلبات وقدّم عروض</p>
                <p className="text-xs opacity-60">Accept orders and place bids</p>
              </div>
              <div className="text-white/60 text-2xl">›</div>
            </div>
          </div>
        </Link>

        <Link href="/admin/login">
          <div className="rounded-2xl p-5 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)" }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
                🛡️
              </div>
              <div className="text-white flex-1">
                <p className="text-xl font-black">إدارة</p>
                <p className="text-sm font-bold opacity-90">Admin</p>
                <p className="text-xs opacity-75 mt-0.5">إدارة النظام والمستخدمين</p>
                <p className="text-xs opacity-60">Manage system and users</p>
              </div>
              <div className="text-white/60 text-2xl">›</div>
            </div>
          </div>
        </Link>
      </div>

      <p className="text-gray-400 text-xs mt-8">اختر نوع الحساب للدخول إلى النظام</p>
    </div>
  );
}
