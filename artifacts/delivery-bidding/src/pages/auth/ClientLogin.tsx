import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useClientLogin();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !password.trim()) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { mobile: mobile.trim(), password } },
      {
        onSuccess: (data) => { login(data); setLocation("/client"); },
        onError: (err: Error) => { toast({ title: err.message ?? "بيانات الدخول غير صحيحة", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#000000" }} dir="rtl">
      {/* Hero header */}
      <div className="px-6 pt-10 pb-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          ← العودة
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ backgroundColor: "#deff9a" }}>
            📦
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#deff9a" }}>توصّلني</h1>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>بوابة العميل</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-2">
        <div className="rounded-3xl p-7" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-xl font-black text-white mb-1">تسجيل الدخول</h2>
          <p className="text-sm font-bold mb-7" style={{ color: "rgba(255,255,255,0.4)" }}>أدخل رقم جوالك وكلمة المرور</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>رقم الجوال</label>
              <input
                type="tel"
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                dir="ltr"
                autoFocus
                className="input-dark w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="input-dark w-full pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full btn-primary mt-2 disabled:opacity-50"
            >
              {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.35)" }}>
            ليس لديك حساب؟{" "}
            <Link href="/client/register" className="font-bold" style={{ color: "#deff9a" }}>سجّل الآن</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
