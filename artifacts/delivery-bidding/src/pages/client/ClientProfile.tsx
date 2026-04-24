import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { API_ORIGIN as API } from "@/lib/api-config";

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
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تحديث البيانات");
      toast({ title: "تم حفظ البيانات بنجاح" });
      setMobile("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast({ title: "كلمة المرور الجديدة غير متطابقة", variant: "destructive" }); return; }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API}/api/auth/me/password`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل تغيير كلمة المرور");
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  return (
    <Layout role="client">
      <div dir="rtl" className="max-w-lg mx-auto space-y-4">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">ملفي الشخصي</h1>
          <p className="text-gray-400 text-sm">تحديث بياناتك الشخصية</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">👤</div>
            <div>
              <p className="font-black text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-400">عميل</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاسم الكامل</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={user?.name}
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الجوال الجديد (اختياري)</label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <button type="submit" disabled={savingProfile} className="w-full py-3 rounded-xl text-white font-black disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
              {savingProfile ? "جاري الحفظ..." : "حفظ البيانات"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">🔒</div>
            <p className="font-black text-gray-800">تغيير كلمة المرور</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">كلمة المرور الحالية</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">كلمة المرور الجديدة</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6 أحرف على الأقل"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">تأكيد كلمة المرور</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                className="rounded-xl border-gray-200 focus:border-blue-400" />
            </div>
            <button type="submit" disabled={savingPassword}
              className="w-full py-3 rounded-xl border border-gray-200 font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors">
              {savingPassword ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
