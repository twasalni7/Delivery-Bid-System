import { useState } from "react";
import { Link, useLocation } from "wouter";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ClientRegister() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !password || !confirm) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const supabase = getSupabase();
      // بناء البريد الإلكتروني من رقم الجوال (نفس الأسلوب المتفق عليه)
      const email = `${mobile.trim()}@client.twasalni.com`;

      // إنشاء حساب Supabase Auth — الـ trigger يُنشئ صف profiles تلقائياً
      // ويضع full_name و role='customer' من الـ metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name.trim(),
            role: "customer",
          },
        },
      });

      if (signUpError) {
        toast({ title: signUpError.message ?? "فشل إنشاء الحساب", variant: "destructive" });
        return;
      }

      // تحديث حقل phone في profiles لأن الـ trigger لا يحفظه تلقائياً
      const userId = data.user?.id;
      if (userId) {
        await supabase
          .from("profiles")
          .update({ phone: mobile.trim() })
          .eq("id", userId);
      }

      await refetch();
      setLocation("/client");
    } catch {
      toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="p-5 pb-8" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}>
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
              <Input placeholder="مثال: محمد العتيبي" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الجوال</label>
              <Input type="tel" placeholder="05xxxxxxxx" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">كلمة المرور</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">تأكيد كلمة المرور</label>
              <Input type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-2xl text-white font-black shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}
            >
              {isPending ? "جاري التسجيل..." : "إنشاء الحساب"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            لديك حساب بالفعل؟{" "}
            <Link href="/client/login" className="text-blue-600 font-bold hover:underline">سجّل دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
