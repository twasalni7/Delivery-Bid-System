import { useState } from "react";
import { Link, useLocation } from "wouter";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [loginCode, setLoginCode] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      toast({ title: "يرجى إدخال رمز الدخول", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const supabase = getSupabase();
      // بريد ثابت للمدير + رمز الدخول كـ password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: "admin@twasalni.com",
        password: loginCode.trim(),
      });
      if (authError) {
        console.log("Supabase auth error:", authError);
        toast({ title: "رمز الدخول غير صحيح", variant: "destructive" });
        return;
      }

      // التحقق من أن دور المستخدم في قاعدة البيانات هو "admin"
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        console.log("Profile query error:", profileError);
        await supabase.auth.signOut();
        toast({ title: "تعذّر التحقق من صلاحيات المستخدم، يرجى المحاولة مجدداً", variant: "destructive" });
        return;
      }

      if (profile?.role !== "admin") {
        console.log("Access denied: user role is", profile?.role);
        await supabase.auth.signOut();
        toast({ title: "هذا الحساب ليس حساب مدير، لا يمكن الدخول", variant: "destructive" });
        return;
      }

      await refetch();
      setLocation("/admin");
    } catch (err) {
      console.log("Unexpected login error:", err);
      toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="p-5 pb-8" style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)" }}>
        <Link href="/" className="text-white/70 text-sm flex items-center gap-1 mb-6 hover:text-white">← العودة</Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">🛡️</div>
          <div>
            <h1 className="text-2xl font-black text-white">توصّلني</h1>
            <p className="text-white/70 text-sm">لوحة الإدارة</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="text-xl font-black text-gray-900 mb-1">دخول الإدارة</h2>
          <p className="text-gray-400 text-sm mb-5">أدخل رمز دخول المدير للوصول</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رمز الدخول</label>
              <Input placeholder="ADMIN2024" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} dir="ltr" autoFocus
                className="rounded-xl border-gray-200 focus:border-violet-400" />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-2xl text-white font-black shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)" }}
            >
              {isPending ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
