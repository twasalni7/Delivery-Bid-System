import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Landmark, Plus, Trash2, CheckCircle2, Eye, FileImage, AlertCircle, KeyRound, CreditCard, User } from "lucide-react";
import { getAuthHeaders } from "@/lib/authed-fetch";

import { API_ORIGIN as API } from "@/lib/api-config";

type BankAccount = {
  intId: number;
  bankName: string;
  iban: string;
  accountHolderName: string;
  isActive: boolean;
};

type WalletTx = {
  intId: number;
  driverId: number;
  driverName: string | null;
  amount: number | string;
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
    fetch(`${API}/api/bank-accounts/all`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAccounts(d); })
      .catch((err) => {
        console.error("Failed to fetch bank accounts:", err);
        toast({ title: "فشل تحميل الحسابات البنكية", variant: "destructive" });
      });

    fetch(`${API}/api/wallet-transactions`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setWalletTxs(d); })
      .catch((err) => {
        console.error("Failed to fetch wallet transactions:", err);
        toast({ title: "فشل تحميل طلبات الشحن", variant: "destructive" });
      });
  }, [toast]);

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCode.trim().length < 6) { toast({ title: "يجب أن يكون الرمز 6 أحرف أو أكثر", variant: "destructive" }); return; }
    if (newCode.trim() !== confirmCode.trim()) { toast({ title: "الرمزان غير متطابقان", variant: "destructive" }); return; }
    if (!confirm(`هل تريد تغيير رمز الدخول إلى "${newCode.trim()}"؟`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/change-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

  const handleDeleteBank = async (intId: number) => {
    if (!confirm("هل تريد حذف هذا الحساب؟")) return;
    try {
      const res = await fetch(`${API}/api/bank-accounts/${intId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("فشل الحذف");
      setAccounts((prev) => prev.filter((a) => a.intId !== intId));
      toast({ title: "تم حذف الحساب" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  const handleWalletAction = async (intId: number, action: "approve" | "reject") => {
    setProcessingId(intId);
    try {
      const res = await fetch(`${API}/api/wallet-transactions/${intId}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشلت العملية");
      // Refresh the full list to reflect the server-computed balance change
      const updated = await fetch(`${API}/api/wallet-transactions`, { headers: getAuthHeaders() })
        .then((r) => r.json())
        .catch(() => {
          toast({ title: "تم تحديث الحالة، يرجى تحديث الصفحة لرؤية الرصيد المحدّث", variant: "destructive" });
          return null;
        });
      if (Array.isArray(updated)) setWalletTxs(updated);
      else setWalletTxs((prev) =>
        prev.map((tx) => (tx.intId === intId ? { ...tx, status: action === "approve" ? "approved" : "rejected" } : tx))
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
      <div dir="rtl" className="space-y-5">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>إعدادات الإدارة</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>إدارة الحسابات البنكية وطلبات الشحن ورمز الدخول</p>
          </div>
        </div>

        {/* ── Pending Alert Banner ── */}
        {pendingTxs.length > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: "var(--status-open-bg)", border: "1px solid var(--status-open-border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--status-open-bg)" }}>
              <AlertCircle size={20} style={{ color: "var(--status-open-text)" }} />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: "var(--status-open-text)" }}>
                يوجد {pendingTxs.length} {pendingTxs.length === 1 ? "طلب شحن معلّق" : "طلبات شحن معلّقة"} تنتظر مراجعتك
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--status-open-text)" }}>راجع قسم طلبات الشحن أدناه وقم بالقبول أو الرفض</p>
            </div>
            <span className="text-3xl font-black shrink-0" style={{ color: "var(--status-open-text)" }}>{pendingTxs.length}</span>
          </div>
        )}

        {/* ── Two-column layout on lg ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ── LEFT COLUMN: Wallet Transactions (3/5) ── */}
          <div className="w-full lg:w-3/5">
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}>
                    <CreditCard size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-black text-white">طلبات شحن المحافظ</p>
                    <p className="text-xs" style={{ color: "var(--text-hint)" }}>{walletTxs.length} طلب إجمالي</p>
                  </div>
                </div>
                {pendingTxs.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black" style={{ backgroundColor: "var(--status-open-bg)", color: "var(--status-open-text)" }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--status-open-text)" }} />
                    {pendingTxs.length} معلّق
                  </span>
                )}
              </div>

              {walletTxs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3">💳</div>
                  <p className="font-bold" style={{ color: "var(--text-muted)" }}>لا توجد طلبات شحن حتى الآن</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {walletTxs.map((tx) => {
                    const driverInitial = (tx.driverName ?? `س${tx.driverId}`).charAt(0);
                    const isPending = tx.status === "pending";
                    return (
                      <div key={tx.intId} className="p-5 transition-colors" style={{ backgroundColor: isPending ? "var(--status-open-bg)" : "transparent" }}>
                        {/* Driver + amount row */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0"
                            style={{ background: "linear-gradient(135deg, var(--brand-hover), var(--brand))" }}>
                            {driverInitial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base truncate" style={{ color: "var(--text)" }}>
                              {tx.driverName ?? `سائق #${tx.driverId}`}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-hint)" }}>
                              {new Date(tx.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="font-black text-2xl" style={{ color: "var(--text)" }} dir="ltr">
                              {parseFloat(String(tx.amount)).toFixed(0)}
                              <span className="text-sm font-bold mr-1" style={{ color: "var(--text-hint)" }}>ر.س</span>
                            </p>
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--status-open-bg)", color: "var(--status-open-text)" }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--status-open-text)" }} />معلّق
                              </span>
                            ) : tx.status === "approved" ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--status-active-bg)", color: "var(--status-active-text)" }}>
                                <CheckCircle2 size={11} />مقبول
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" }}>مرفوض</span>
                            )}
                          </div>
                        </div>

                        {/* Receipt button */}
                        {tx.receiptUrl && (
                          <a
                            href={tx.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors min-h-[36px]"
                            style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)", color: "var(--brand)" }}
                          >
                            <Eye size={14} />
                            عرض صورة الإيصال
                            <FileImage size={13} className="text-blue-400" />
                          </a>
                        )}

                        {/* Action buttons for pending */}
                        {isPending && (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleWalletAction(tx.intId, "approve")}
                              disabled={processingId === tx.intId}
                              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-black text-sm disabled:opacity-50 min-h-[44px]"
                              style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}>
                              <CheckCircle2 size={16} />
                              {processingId === tx.intId ? "جاري المعالجة..." : "قبول وشحن الرصيد"}
                            </button>
                            <button
                              onClick={() => handleWalletAction(tx.intId, "reject")}
                              disabled={processingId === tx.intId}
                              className="px-5 py-3 rounded-xl font-black text-sm disabled:opacity-50 min-h-[44px] transition-colors"
                              style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)" }}>
                              رفض
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Bank Accounts + Login Code (2/5) ── */}
          <div className="w-full lg:w-2/5 space-y-5">

            {/* Bank Accounts Card */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                  <Landmark size={18} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <p className="font-black" style={{ color: "var(--text)" }}>الحسابات البنكية</p>
                  <p className="text-xs" style={{ color: "var(--text-hint)" }}>للتحويل من قِبل السائقين</p>
                </div>
              </div>

              <div className="p-5">
                {accounts.length > 0 ? (
                  <div className="space-y-3 mb-5">
                    {accounts.map((acc) => (
                      <div key={acc.intId} className="relative p-4 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-sm" style={{ color: "var(--text)" }}>{acc.bankName}</p>
                            <p className="text-sm font-mono mt-1 break-all" dir="ltr" style={{ color: "var(--text-sub)" }}>{acc.iban}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <User size={12} className="shrink-0" style={{ color: "var(--text-hint)" }} />
                              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{acc.accountHolderName}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteBank(acc.intId)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 min-h-[32px]"
                            style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)", color: "var(--status-cancelled-text)" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 mb-4">
                    <Landmark size={28} className="mx-auto mb-2" style={{ color: "var(--border)" }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>لا توجد حسابات بنكية مضافة</p>
                  </div>
                )}

                {/* Add Bank Form */}
                <form onSubmit={handleAddBank} className="space-y-3 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-xs font-black flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Plus size={13} />
                    إضافة حساب جديد
                  </p>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="اسم البنك (مثال: الراجحي)"
                    className="rounded-xl text-sm h-11 input-dark"
                  />
                  <Input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="SA00 0000 0000 0000 0000 0000"
                    dir="ltr"
                    className="rounded-xl text-sm font-mono h-11 input-dark"
                  />
                  <Input
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="اسم صاحب الحساب"
                    className="rounded-xl text-sm h-11 input-dark"
                  />
                  <button
                    type="submit"
                    disabled={addingBank}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 min-h-[44px]"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
                    <Plus size={16} />
                    {addingBank ? "جاري الإضافة..." : "إضافة الحساب"}
                  </button>
                </form>
              </div>
            </div>

            {/* Login Code Card */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                  <KeyRound size={18} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <p className="font-black" style={{ color: "var(--text)" }}>رمز الدخول السري</p>
                  <p className="text-xs" style={{ color: "var(--text-hint)" }}>تغيير رمز تسجيل دخول المشرف</p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: "var(--status-open-bg)", border: "1px solid var(--status-open-border)" }}>
                  <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: "var(--status-open-text)" }} />
                  <p className="text-xs" style={{ color: "var(--status-open-text)" }}>احتفظ بالرمز الجديد في مكان آمن. ستحتاجه لتسجيل الدخول لاحقاً.</p>
                </div>

                <form onSubmit={handleChangeCode} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>الرمز الجديد (6 أحرف على الأقل)</label>
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="NEWCODE123"
                      dir="ltr"
                      minLength={6}
                      className="rounded-xl h-11 input-dark"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1.5 block" style={{ color: "var(--text-muted)" }}>تأكيد الرمز الجديد</label>
                    <Input
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      placeholder="NEWCODE123"
                      dir="ltr"
                      className="rounded-xl h-11 input-dark"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 rounded-xl text-white font-black disabled:opacity-50 min-h-[44px]"
                    style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                    {saving ? "جاري التغيير..." : "تغيير الرمز"}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
