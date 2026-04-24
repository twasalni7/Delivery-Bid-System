import { useState } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

import { API_ORIGIN as API } from "@/lib/api-config";

export default function AdminSettings() {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCode.trim().length < 6) { toast({ title: "يجب أن يكون الرمز 6 أحرف أو أكثر", variant: "destructive" }); return; }
    if (newCode.trim() !== confirmCode.trim()) { toast({ title: "الرمزان غير متطابقان", variant: "destructive" }); return; }
    if (!confirm(`هل تريد تغيير رمز الدخول إلى "${newCode.trim()}"؟`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/change-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newCode: newCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تغيير الرمز");
      toast({ title: `تم تغيير رمز الدخول إلى: ${data.loginCode}` });
      setNewCode(""); setConfirmCode("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout role="admin">
      <div dir="rtl" className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">إعدادات الإدارة</h1>
          <p className="text-gray-400 text-sm">إعدادات حساب المشرف</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">⚙️</div>
            <p className="font-black text-gray-800">تغيير رمز الدخول السري</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-5">
            <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">احتفظ بالرمز الجديد في مكان آمن. ستحتاجه لتسجيل الدخول في المرة القادمة.</p>
          </div>

          <form onSubmit={handleChangeCode} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرمز الجديد (6 أحرف على الأقل)</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="NEWCODE123" dir="ltr" minLength={6}
                className="rounded-xl border-gray-200 focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">تأكيد الرمز الجديد</label>
              <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="NEWCODE123" dir="ltr"
                className="rounded-xl border-gray-200 focus:border-violet-400" />
            </div>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl text-white font-black disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
              {saving ? "جاري التغيير..." : "تغيير الرمز"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
