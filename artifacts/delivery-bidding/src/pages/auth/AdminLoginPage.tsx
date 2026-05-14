import { useState, Component, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

// Error Boundary wrapper for login page
class LoginErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Login page error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg)" }} dir="rtl">
          <div className="text-center p-8">
            <p className="text-5xl mb-4">😕</p>
            <h1 className="text-2xl font-black mb-2" style={{ color: "var(--text)" }}>حدث خطأ غير متوقع</h1>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>تعذر تحميل صفحة تسجيل الدخول</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AdminLoginContent() {
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
          <h2 className="text-xl font-black mb-1" style={{ color: "var(--text)" }}>دخول الإدارة</h2>
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

export default function AdminLoginPage() {
  return (
    <LoginErrorBoundary>
      <AdminLoginContent />
    </LoginErrorBoundary>
  );
}
