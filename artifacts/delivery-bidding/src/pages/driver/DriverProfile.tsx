import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetDriverMe, getGetDriverMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Upload, CheckCircle2, Clock, X, Landmark, User, Phone, Car, Globe, CreditCard, AlertTriangle } from "lucide-react";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getSupabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

type WalletTx = {
  id: number;
  amount: number | string;
  receiptUrl: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type BankAccount = {
  id: number;
  bankName: string;
  iban: string;
  accountHolderName: string;
};

export default function DriverProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: driver, isLoading } = useGetDriverMe({
    query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user },
  });

  const [showChargeModal, setShowChargeModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!user) setLocation("/driver/login"); }, [user, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/wallet-transactions`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTransactions(data); })
      .catch(() => {});

    fetch(`${API}/api/bank-accounts`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBankAccounts(data); })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  if (isLoading) {
    return <Layout role="driver"><div className="text-center py-16 text-gray-400">جاري التحميل...</div></Layout>;
  }

  const handleChargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
      return;
    }
    if (!receiptFile) {
      toast({ title: "يرجى إرفاق صورة الإيصال", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let receiptUrl: string | null = null;

      // Upload receipt image to Supabase Storage (if configured)
      try {
        const supabase = getSupabase();
        const ext = receiptFile.name.split(".").pop() ?? "jpg";
        const fileName = `receipts/${user.id}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, receiptFile, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(uploadData.path);
        receiptUrl = urlData?.publicUrl ?? null;
      } catch {
        // Supabase Storage not configured — save without URL
      }

      const res = await fetch(`${API}/api/wallet-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: numAmount, receiptUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل إرسال الطلب");

      toast({ title: "✅ تم إرسال طلب الشحن", description: "سيتم مراجعة الطلب من قِبل الإدارة" });
      setTransactions((prev) => [data, ...prev]);
      queryClient.invalidateQueries({ queryKey: getGetDriverMeQueryKey() });
      setShowChargeModal(false);
      setAmount("");
      setReceiptFile(null);
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status: WalletTx["status"]) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold"><CheckCircle2 size={11} />مقبول</span>;
    if (status === "rejected") return <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-bold">مرفوض</span>;
    return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold"><Clock size={11} />قيد المراجعة</span>;
  };

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-5">

        {/* ── Hero Balance Card ── */}
        {driver && (
          <div className="rounded-2xl overflow-hidden shadow-lg"
            style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 60%, #047857 100%)" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">🚗</div>
                  <div>
                    <p className="text-white font-black text-xl">{driver.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        driver.status === "ACTIVE" ? "bg-emerald-400/30 text-emerald-100"
                        : driver.status === "BLOCKED" ? "bg-red-400/30 text-red-200"
                        : "bg-white/20 text-white/70"
                      }`}>
                        {driver.status === "ACTIVE" ? "✓ نشط" : driver.status === "BLOCKED" ? "محظور" : driver.status}
                      </span>
                      {driver.warningCount !== undefined && driver.warningCount > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-400/30 text-amber-100">
                          ⚠️ {driver.warningCount} تحذير
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-white/60 text-xs font-bold mb-1">رصيد المحفظة</p>
                  <p className="text-white font-black" style={{ fontSize: "2.75rem", lineHeight: 1 }} dir="ltr">
                    {driver.balance?.toFixed(2)}
                    <span className="text-xl font-bold text-white/60 mr-2">ر.س</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm min-h-[44px] bg-white text-emerald-800 shadow-lg active:scale-95 transition-transform"
                >
                  <Wallet size={16} />
                  شحن المحفظة
                </button>
              </div>

              {driver.balance < 50 && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/20 border border-red-400/30">
                  <AlertTriangle size={16} className="text-red-300 shrink-0" />
                  <p className="text-red-100 text-xs font-bold">
                    رصيدك أقل من 50 ريال — لا يمكنك تقديم عروض. اشحن محفظتك الآن.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {driver && (
          <>
            {/* ── Bank Accounts for Transfer ── */}
            {bankAccounts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-5 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Landmark size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900">حسابات التحويل</p>
                    <p className="text-xs text-gray-400">حوّل إليها للشحن ثم ارفع الإيصال</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="p-4 rounded-xl bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-black text-gray-900 text-sm">{acc.bankName}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">للتحويل</span>
                      </div>
                      <p className="text-base font-mono font-bold text-gray-700 mb-1" dir="ltr">{acc.iban}</p>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-500">{acc.accountHolderName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Wallet History ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900">سجل الشحن</p>
                    <p className="text-xs text-gray-400">آخر طلبات شحن المحفظة</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="flex items-center gap-1.5 text-xs font-black text-white px-3 py-2 rounded-xl min-h-[36px]"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                >
                  + شحن جديد
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl mb-3">💳</div>
                  <p className="font-bold text-gray-400 text-sm">لا توجد معاملات شحن حتى الآن</p>
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold min-h-[40px]"
                    style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                  >
                    <Wallet size={14} />
                    ابدأ بشحن محفظتك
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {transactions.slice(0, 8).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="font-black text-gray-900 text-base" dir="ltr">
                          {parseFloat(String(tx.amount)).toFixed(2)}
                          <span className="text-sm font-bold text-gray-400 mr-1">ر.س</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long" })}
                        </p>
                      </div>
                      {statusBadge(tx.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Profile Info ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <User size={18} className="text-gray-600" />
                </div>
                <p className="font-black text-gray-900">بياناتي الشخصية</p>
              </div>
              <div className="p-5 space-y-1">
                {driver.mobile && (
                  <ProfileRow icon={<Phone size={15} className="text-gray-400" />} label="رقم الجوال" value={driver.mobile} ltr />
                )}
                {driver.carType && (
                  <ProfileRow icon={<Car size={15} className="text-gray-400" />} label="نوع السيارة" value={driver.carType} />
                )}
                {driver.nationality && (
                  <ProfileRow icon={<Globe size={15} className="text-gray-400" />} label="الجنسية" value={driver.nationality} />
                )}
                {driver.age && (
                  <ProfileRow icon={<span className="text-sm">🎂</span>} label="العمر" value={`${driver.age} سنة`} />
                )}
                {driver.nationalId && (
                  <ProfileRow icon={<span className="text-sm">🪪</span>} label="رقم الهوية" value={driver.nationalId} ltr />
                )}
                <ProfileRow
                  icon={<span className="text-sm">📅</span>}
                  label="تاريخ التسجيل"
                  value={driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("ar-SA") : "—"}
                />
              </div>
              <div className="mx-5 mb-5 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
                <span className="text-base">🔑</span>
                <p className="text-xs text-gray-400">رمز تسجيل الدخول يُدار بواسطة الإدارة — تواصل معهم لتغييره</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Charge Modal ── */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" dir="rtl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100"
              style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-white">طلب شحن المحفظة</p>
                  <p className="text-white/60 text-xs">أرسل الإيصال بعد التحويل</p>
                </div>
              </div>
              <button
                onClick={() => { setShowChargeModal(false); setReceiptFile(null); setAmount(""); }}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Bank accounts inside modal */}
              {bankAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-500 flex items-center gap-1.5">
                    <Landmark size={13} />
                    حوّل المبلغ إلى أحد هذه الحسابات أولاً:
                  </p>
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-black text-gray-900 text-sm">{acc.bankName}</p>
                      </div>
                      <p className="text-sm font-mono font-bold text-blue-800" dir="ltr">{acc.iban}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{acc.accountHolderName}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChargeSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">المبلغ المحوّل (ريال)</label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    dir="ltr"
                    className="rounded-xl border-gray-200 focus:border-emerald-400 h-12 text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">إيصال التحويل (صورة)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {receiptFile ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 min-h-[48px]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span className="text-sm text-emerald-800 font-bold truncate max-w-[180px]">{receiptFile.name}</span>
                      </div>
                      <button type="button" onClick={() => setReceiptFile(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors min-h-[52px]"
                    >
                      <Upload size={18} />
                      اضغط لإرفاق صورة الإيصال
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Clock size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">سيتم مراجعة الطلب من قِبل الإدارة وإضافة الرصيد خلال 24 ساعة.</p>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3.5 rounded-xl text-white font-black disabled:opacity-50 min-h-[52px] text-base"
                  style={{ background: "linear-gradient(135deg, #064E3B, #065F46)" }}
                >
                  {uploading ? "جاري الإرسال..." : "إرسال طلب الشحن ✓"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ProfileRow({ icon, label, value, ltr }: { icon: React.ReactNode; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-50 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-500">
        {icon}
        {label}
      </span>
      <span className="font-bold text-sm text-gray-800" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
