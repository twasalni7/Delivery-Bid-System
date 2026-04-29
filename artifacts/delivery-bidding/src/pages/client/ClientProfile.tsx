import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
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
      <div dir="rtl" className="max-w-lg mx-auto space-y-5">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">ملفي الشخصي</h1>
          <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>تحديث بياناتك الشخصية</p>
        </div>

        <div className="rounded-3xl p-6" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: "rgba(222,255,154,0.1)", border: "1px solid rgba(222,255,154,0.2)" }}>
              👤
            </div>
            <div>
              <p className="font-black text-white text-lg">{user?.name}</p>
              <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>عميل</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>الاسم الكامل</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={user?.name}
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>رقم الجوال الجديد (اختياري)</label>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr"
                className="input-dark w-full" />
            </div>
            <button type="submit" disabled={savingProfile} className="w-full btn-primary disabled:opacity-50">
              {savingProfile ? "جاري الحفظ..." : "حفظ البيانات"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl p-6" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>🔒</div>
            <p className="font-black text-white text-lg">تغيير كلمة المرور</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>كلمة المرور الحالية</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>كلمة المرور الجديدة</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6 أحرف على الأقل"
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "rgba(255,255,255,0.6)" }}>تأكيد كلمة المرور</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                className="input-dark w-full" />
            </div>
            <button type="submit" disabled={savingPassword}
              className="w-full btn-ghost disabled:opacity-50">
              {savingPassword ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
