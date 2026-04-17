import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Phone } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ClientProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [mobile, setMobile] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const body: Record<string, string> = {};
      if (name.trim()) body.name = name.trim();
      if (mobile.trim()) body.mobile = mobile.trim();
      const res = await fetch(`${API}/api/auth/me/client`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تحديث البيانات");
      toast({ title: "تم حفظ البيانات بنجاح" });
      setMobile("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "كلمة المرور الجديدة غير متطابقة", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API}/api/auth/me/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تغيير كلمة المرور");
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Layout role="client">
      <div dir="rtl" className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black">ملفي الشخصي</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تحديث بياناتك الشخصية</p>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User size={16} className="text-primary" />
              البيانات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">الاسم الكامل</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={user?.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs flex items-center gap-1">
                  <Phone size={12} /> رقم الجوال الجديد (اختياري)
                </Label>
                <Input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={savingProfile}>
                {savingProfile ? "جاري الحفظ..." : "حفظ البيانات"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock size={16} className="text-primary" />
              تغيير كلمة المرور
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">كلمة المرور الحالية</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">كلمة المرور الجديدة</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">تأكيد كلمة المرور</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" variant="outline" className="w-full font-bold" disabled={savingPassword}>
                {savingPassword ? "جاري التغيير..." : "تغيير كلمة المرور"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
