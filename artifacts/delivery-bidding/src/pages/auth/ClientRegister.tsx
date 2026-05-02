import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

export default function ClientRegister() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useClientRegister();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordStrong = password.length >= 6;
  const passwordsMatch = password.length > 0 && confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !password || !confirm) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "يجب أن تكون كلمة المرور 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    registerMutation.mutate(
      { data: { name: name.trim(), mobile: mobile.trim(), password } },
      {
        onSuccess: (data) => { login(data); setLocation("/client"); },
        onError: (err: Error) => { toast({ title: err.message ?? "فشل إنشاء الحساب", variant: "destructive" }); },
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
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>تسجيل عميل جديد</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-2 pb-8">
        <div className="rounded-3xl p-7" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-xl font-black text-white mb-1">إنشاء حساب</h2>
          <p className="text-sm font-bold mb-7" style={{ color: "rgba(255,255,255,0.4)" }}>أدخل بياناتك لإنشاء حساب عميل</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>الاسم الكامل</label>
              <input
                placeholder="مثال: محمد العتيبي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="input-dark w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>رقم الجوال</label>
              <input
                type="tel"
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                dir="ltr"
                className="input-dark w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold block" htmlFor="password-field" style={{ color: "rgba(255,255,255,0.6)" }}>
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password-field"
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
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <p className={`text-xs flex items-center gap-1 ${passwordStrong ? "text-emerald-400" : "text-red-400"}`}>
                  {passwordStrong
                    ? <><CheckCircle2 size={12} /> كلمة مرور قوية</>
                    : <><XCircle size={12} /> يجب أن تكون 6 أحرف على الأقل</>}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold block" htmlFor="confirm-field" style={{ color: "rgba(255,255,255,0.6)" }}>
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="confirm-field"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  dir="ltr"
                  aria-invalid={passwordsMismatch}
                  aria-describedby={passwordsMismatch ? "confirm-error" : passwordsMatch ? "confirm-ok" : undefined}
                  className={`input-dark w-full pl-10 ${passwordsMismatch ? "border-red-500/50" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                  tabIndex={-1}
                  aria-label={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordsMatch && (
                <p id="confirm-ok" className="text-xs flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={12} /> كلمتا المرور متطابقتان
                </p>
              )}
              {passwordsMismatch && (
                <p id="confirm-error" className="text-xs flex items-center gap-1 text-red-400" role="alert">
                  <XCircle size={12} /> كلمتا المرور غير متطابقتين
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full btn-primary mt-2 disabled:opacity-50"
            >
              {registerMutation.isPending ? "جاري التسجيل..." : "إنشاء الحساب"}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.35)" }}>
            لديك حساب بالفعل؟{" "}
            <Link href="/client/login" className="font-bold" style={{ color: "#deff9a" }}>سجّل دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
