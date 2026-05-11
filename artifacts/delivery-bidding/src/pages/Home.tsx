import { Link } from "wouter";
import { Package, Truck, Shield } from "lucide-react";

export default function Home() {
  return (
    <div
      className="min-h-screen pb-10 px-4 sm:px-6 flex items-center justify-center"
      dir="rtl"
      style={{ fontFamily: "var(--font-arabic)", background: "#f5f5f5" }}
    >
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Delivery Bid Management System</h1>
          <p className="text-sm text-gray-500">اختر نوع الحساب للدخول إلى النظام</p>
          <p className="text-xs text-gray-400 mt-1">Select account type to access the system</p>
        </div>

        <div className="space-y-5">
          {/* Client Card */}
          <Link href="/client/login">
            <div
              className="rounded-3xl p-8 text-white text-center cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)" }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center">
                <Package size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">عميل</h2>
              <p className="text-sm font-medium opacity-90">Customer</p>
              <p className="text-sm mt-3 opacity-95 leading-relaxed">
                اطلب توصيل واطلع العروض<br />
                Request delivery and view bids
              </p>
            </div>
          </Link>

          {/* Driver Card */}
          <Link href="/driver/login">
            <div
              className="rounded-3xl p-8 text-white text-center cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)" }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center">
                <Truck size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">سائق</h2>
              <p className="text-sm font-medium opacity-90">Driver</p>
              <p className="text-sm mt-3 opacity-95 leading-relaxed">
                استلم الطلبات واقدم عروض<br />
                Accept orders and place bids
              </p>
            </div>
          </Link>

          {/* Admin Card */}
          <Link href="/admin/login">
            <div
              className="rounded-3xl p-8 text-white text-center cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)" }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center">
                <Shield size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">إدارة</h2>
              <p className="text-sm font-medium opacity-90">Admin</p>
              <p className="text-sm mt-3 opacity-95 leading-relaxed">
                إدارة النظام والمستخدمين<br />
                Manage system and users
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
