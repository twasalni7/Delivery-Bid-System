import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useDriverLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function DriverLoginPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const loginMutation = useDriverLogin();
  const [mobile, setMobile] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !loginCode.trim()) {
      toast({ title: "يرجى إدخال رقم الجوال ورمز الدخول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { mobile: mobile.trim(), loginCode: loginCode.trim() } },
      {
        onSuccess: async () => { await refetch(); setLocation("/driver/dashboard"); },
        onError: (err: Error) => { toast({ title: err.message ?? "بيانات الدخول غير صحيحة", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="p-5 pb-8" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
        <Link href="/" className="text-white/70 text-sm flex items-center gap-1 mb-6 hover:text-white">← العودة</Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">🚗</div>
          <div>
            <h1 className="text-2xl font-black text-white">توصّلني</h1>
            <p className="text-white/70 text-sm">بوابة السائق</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="text-xl font-black text-gray-900 mb-1">دخول السائق</h2>
          <p className="text-gray-400 text-sm mb-5">يُسجَّل السائقون عبر الإدارة ويحصلون على رمز دخول</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الجوال</label>
              <Input type="tel" placeholder="05xxxxxxxx" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" autoFocus
                className="rounded-xl border-gray-200 focus:border-green-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رمز الدخول</label>
              <Input placeholder="الرمز المعطى من الإدارة" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} dir="ltr"
                className="rounded-xl border-gray-200 focus:border-green-400" />
            </div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3.5 rounded-2xl text-white font-black shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
            >
              {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
