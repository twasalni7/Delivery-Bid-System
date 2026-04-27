import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

export default function ClientRegister() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
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
        onSuccess: async () => { await refetch(); setLocation("/client"); },
        onError: (err: Error) => { toast({ title: err.message ?? "فشل إنشاء الحساب", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="p-5 pb-8" style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}>
        <Link href="/" className="text-white/70 text-sm flex items-center gap-1 mb-6 hover:text-white">← العودة</Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">📦</div>
          <div>
            <h1 className="text-2xl font-black text-white">توصّلني</h1>
            <p className="text-white/70 text-sm">تسجيل عميل جديد</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="text-xl font-black text-gray-900 mb-1">إنشاء حساب</h2>
          <p className="text-gray-400 text-sm mb-5">أدخل بياناتك لإنشاء حساب عميل</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاسم الكامل</label>
              <Input
                placeholder="مثال: محمد العتيبي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="rounded-xl border-gray-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الجوال</label>
              <Input
                type="tel"
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                dir="ltr"
                className="rounded-xl border-gray-200 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block" htmlFor="password-field">كلمة المرور</label>
              <div className="relative">
                <Input
                  id="password-field"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="rounded-xl border-gray-200 focus:border-indigo-400 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${passwordStrong ? "text-emerald-600" : "text-red-500"}`}>
                  {passwordStrong
                    ? <><CheckCircle2 size={12} /> كلمة مرور قوية</>
                    : <><XCircle size={12} /> يجب أن تكون 6 أحرف على الأقل</>}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block" htmlFor="confirm-field">تأكيد كلمة المرور</label>
              <div className="relative">
                <Input
                  id="confirm-field"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  dir="ltr"
                  aria-invalid={passwordsMismatch}
                  aria-describedby={passwordsMismatch ? "confirm-error" : passwordsMatch ? "confirm-ok" : undefined}
                  className={`rounded-xl pl-10 ${passwordsMismatch ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-indigo-400"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordsMatch && (
                <p id="confirm-ok" className="text-xs mt-1 flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={12} /> كلمتا المرور متطابقتان
                </p>
              )}
              {passwordsMismatch && (
                <p id="confirm-error" className="text-xs mt-1 flex items-center gap-1 text-red-500" role="alert">
                  <XCircle size={12} /> كلمتا المرور غير متطابقتين
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-3.5 rounded-2xl text-white font-black shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}
            >
              {registerMutation.isPending ? "جاري التسجيل..." : "إنشاء الحساب"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            لديك حساب بالفعل؟{" "}
            <Link href="/client/login" className="text-indigo-600 font-bold hover:underline">سجّل دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
