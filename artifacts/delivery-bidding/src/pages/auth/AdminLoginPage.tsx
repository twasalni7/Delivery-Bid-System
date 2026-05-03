import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();
  const [loginCode, setLoginCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      toast({ title: "يرجى إدخال رمز الدخول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { loginCode: loginCode.trim() } },
      {
        onSuccess: (data) => { login(data); setLocation("/admin"); },
        onError: (err: Error) => { toast({ title: err.message ?? "رمز الدخول غير صحيح", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)" }} dir="rtl">
      {/* Hero header */}
      <div className="px-6 pt-10 pb-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-8" style={{ color: "var(--text-muted)" }}>
          ← العودة
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ backgroundColor: "var(--brand)" }}>
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--brand)" }}>توصّلني</h1>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>لوحة الإدارة</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-5 -mt-2">
        <div className="rounded-3xl p-7" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <h2 className="text-xl font-black text-white mb-1">دخول الإدارة</h2>
          <p className="text-sm font-bold mb-7" style={{ color: "var(--text-muted)" }}>أدخل رمز دخول المدير للوصول</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>رمز الدخول</label>
              <input
                placeholder="ADMIN2024"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                dir="ltr"
                autoFocus
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
