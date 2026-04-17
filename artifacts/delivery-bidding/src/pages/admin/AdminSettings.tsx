import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldCheck } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminSettings() {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCode.trim().length < 6) {
      toast({ title: "يجب أن يكون الرمز 6 أحرف أو أكثر", variant: "destructive" });
      return;
    }
    if (newCode.trim() !== confirmCode.trim()) {
      toast({ title: "الرمزان غير متطابقان", variant: "destructive" });
      return;
    }
    if (!confirm(`هل تريد تغيير رمز الدخول إلى "${newCode.trim()}"؟ ستحتاج هذا الرمز لتسجيل الدخول مجدداً.`)) return;
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
      setNewCode("");
      setConfirmCode("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout role="admin">
      <div dir="rtl" className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black">إعدادات الإدارة</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إعدادات حساب المشرف</p>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound size={16} className="text-primary" />
              تغيير رمز الدخول السري
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  احتفظ بالرمز الجديد في مكان آمن. ستحتاجه لتسجيل الدخول في المرة القادمة.
                </p>
              </div>
            </div>
            <form onSubmit={handleChangeCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">الرمز الجديد (6 أحرف على الأقل)</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="NEWCODE123"
                  dir="ltr"
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">تأكيد الرمز الجديد</Label>
                <Input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="NEWCODE123"
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={saving}>
                {saving ? "جاري التغيير..." : "تغيير الرمز"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
