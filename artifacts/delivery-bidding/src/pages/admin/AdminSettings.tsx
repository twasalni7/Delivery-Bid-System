import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Landmark, Plus, Trash2, CheckCircle2 } from "lucide-react";

import { API_ORIGIN as API } from "@/lib/api-config";

type BankAccount = {
  id: number;
  bankName: string;
  iban: string;
  accountHolderName: string;
  isActive: boolean;
};

type WalletTx = {
  id: number;
  driverId: number;
  driverName: string | null;
  amount: number;
  receiptUrl: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export default function AdminSettings() {
  const { toast } = useToast();

  // ── Change login code ──
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Bank accounts ──
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [holderName, setHolderName] = useState("");
  const [addingBank, setAddingBank] = useState(false);

  // ── Wallet transactions ──
  const [walletTxs, setWalletTxs] = useState<WalletTx[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/api/bank-accounts/all`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAccounts(d); })
      .catch(() => {});

    fetch(`${API}/api/wallet-transactions`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setWalletTxs(d); })
      .catch(() => {});
  }, []);

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

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !iban || !holderName) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    setAddingBank(true);
    try {
      const res = await fetch(`${API}/api/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bankName, iban, accountHolderName: holderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الإضافة");
      setAccounts((prev) => [...prev, data]);
      setBankName(""); setIban(""); setHolderName("");
      toast({ title: "✅ تم إضافة الحساب البنكي" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setAddingBank(false);
    }
  };

  const handleDeleteBank = async (id: number) => {
    if (!confirm("هل تريد حذف هذا الحساب؟")) return;
    try {
      const res = await fetch(`${API}/api/bank-accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل الحذف");
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "تم حذف الحساب" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  const handleWalletAction = async (id: number, action: "approve" | "reject") => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API}/api/wallet-transactions/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشلت العملية");
      setWalletTxs((prev) =>
        prev.map((tx) => (tx.id === id ? { ...tx, status: action === "approve" ? "approved" : "rejected" } : tx))
      );
      toast({ title: action === "approve" ? "✅ تم قبول طلب الشحن وإضافة الرصيد" : "تم رفض طلب الشحن" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingTxs = walletTxs.filter((tx) => tx.status === "pending");

  return (
    <Layout role="admin">
      <div dir="rtl" className="max-w-lg mx-auto space-y-6">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">إعدادات الإدارة</h1>
          <p className="text-gray-400 text-sm">إعدادات حساب المشرف</p>
        </div>

        {/* ── Change Login Code ── */}
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

        {/* ── Bank Accounts ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Landmark size={18} className="text-blue-600" />
            </div>
            <p className="font-black text-gray-800">الحسابات البنكية للتحويل</p>
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2 mb-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-start justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{acc.bankName}</p>
                    <p className="text-xs text-gray-500 font-mono" dir="ltr">{acc.iban}</p>
                    <p className="text-xs text-gray-500">{acc.accountHolderName}</p>
                  </div>
                  <button onClick={() => handleDeleteBank(acc.id)} className="text-red-400 hover:text-red-600 mt-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4 text-center py-2">لا توجد حسابات بنكية مضافة</p>
          )}

          <form onSubmit={handleAddBank} className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500">إضافة حساب جديد</p>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="اسم البنك (مثال: الراجحي)"
              className="rounded-xl border-gray-200 focus:border-blue-400 text-sm" />
            <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" dir="ltr"
              className="rounded-xl border-gray-200 focus:border-blue-400 text-sm font-mono" />
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="اسم صاحب الحساب"
              className="rounded-xl border-gray-200 focus:border-blue-400 text-sm" />
            <button type="submit" disabled={addingBank}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
              <Plus size={16} />
              {addingBank ? "جاري الإضافة..." : "إضافة الحساب"}
            </button>
          </form>
        </div>

        {/* ── Wallet Top-up Requests ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">💳</div>
            <div>
              <p className="font-black text-gray-800">طلبات شحن المحافظ</p>
              {pendingTxs.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                  {pendingTxs.length} طلب معلّق
                </span>
              )}
            </div>
          </div>

          {walletTxs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد طلبات شحن</p>
          ) : (
            <div className="space-y-3">
              {walletTxs.map((tx) => (
                <div key={tx.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{tx.driverName ?? `سائق #${tx.driverId}`}</p>
                      <p className="text-xs text-gray-500">{tx.amount.toFixed(2)} ريال — {new Date(tx.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                    {tx.status === "pending" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold shrink-0">معلّق</span>
                    ) : tx.status === "approved" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold shrink-0">مقبول</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold shrink-0">مرفوض</span>
                    )}
                  </div>
                  {tx.receiptUrl && (
                    <a href={tx.receiptUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 underline block mb-2">
                      عرض صورة الإيصال
                    </a>
                  )}
                  {tx.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWalletAction(tx.id, "approve")}
                        disabled={processingId === tx.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
                        <CheckCircle2 size={13} />
                        قبول وشحن
                      </button>
                      <button
                        onClick={() => handleWalletAction(tx.id, "reject")}
                        disabled={processingId === tx.id}
                        className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-200 disabled:opacity-50">
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
