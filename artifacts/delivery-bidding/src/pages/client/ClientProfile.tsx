import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { EnablePushButton } from "@/components/enable-push-button";

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
        method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        <div className="rounded-b-[2.2rem] rounded-t-3xl p-6 text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black border border-white/40 bg-white/20">
              {(user?.name ?? "أ").charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black">{user?.name ?? "العميل"}</h1>
              <p className="text-xs text-violet-200">حساب العميل</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-black mb-4" style={{ color: "var(--text)" }}>الإعدادات والمساعدة</p>
          <div className="space-y-2">
            <Link href="/client/support?topic=faq" className="block rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>الأسئلة الشائعة</span>
            </Link>
            <Link href="/client/support?topic=complaint" className="block rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>رفع شكوى</span>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
              🔔
            </div>
            <div>
              <p className="font-black text-base" style={{ color: "var(--text)" }}>الإشعارات الفورية</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>تلقّ تنبيهات عند وصول عروض جديدة</p>
            </div>
          </div>
          <EnablePushButton />
        </div>

        <div className="rounded-3xl p-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
              👤
            </div>
            <div>
              <p className="font-black text-lg" style={{ color: "var(--text)" }}>{user?.name}</p>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>عميل</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>الاسم الكامل</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={user?.name}
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>رقم الجوال الجديد (اختياري)</label>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr"
                className="input-dark w-full" />
            </div>
            <button type="submit" disabled={savingProfile} className="w-full btn-primary disabled:opacity-50">
              {savingProfile ? "جاري الحفظ..." : "حفظ البيانات"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl p-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: "var(--border-subtle)" }}>🔒</div>
            <p className="font-black text-lg" style={{ color: "var(--text)" }}>تغيير كلمة المرور</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>كلمة المرور الحالية</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>كلمة المرور الجديدة</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6 أحرف على الأقل"
                className="input-dark w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold block" style={{ color: "var(--text-sub)" }}>تأكيد كلمة المرور</label>
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
