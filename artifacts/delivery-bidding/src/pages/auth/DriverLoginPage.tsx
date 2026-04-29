import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useDriverLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#000000" }} dir="rtl">
      {/* Hero header */}
      <div className="px-6 pt-10 pb-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          ← العودة
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ backgroundColor: "#deff9a" }}>
            🚗
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "#deff9a" }}>توصّلني</h1>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>بوابة السائق</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-2">
        <div className="rounded-3xl p-7" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-xl font-black text-white mb-1">دخول السائق</h2>
          <p className="text-sm font-bold mb-7" style={{ color: "rgba(255,255,255,0.4)" }}>
            يُسجَّل السائقون عبر الإدارة ويحصلون على رمز دخول
          </p>

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
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>رمز الدخول</label>
              <input
                placeholder="الرمز المعطى من الإدارة"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                dir="ltr"
                className="input-dark w-full"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full btn-primary mt-2 disabled:opacity-50"
            >
              {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
