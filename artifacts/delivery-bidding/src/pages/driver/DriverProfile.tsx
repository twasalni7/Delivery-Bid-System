import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetDriverMe, getGetDriverMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Upload, CheckCircle2, Clock, X } from "lucide-react";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getSupabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

type WalletTx = {
  id: number;
  amount: number;
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
    if (status === "approved") return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">مقبول</span>;
    if (status === "rejected") return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">مرفوض</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">قيد المراجعة</span>;
  };

  return (
    <Layout role="driver">
      <div dir="rtl" className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">ملفي الشخصي</h1>
          <p className="text-gray-400 text-sm">بياناتك المسجّلة في المنصة</p>
        </div>

        {driver && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-3xl">🚗</div>
                <div>
                  <p className="font-black text-xl text-gray-900">{driver.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      driver.status === "ACTIVE" ? "bg-green-100 text-green-700"
                      : driver.status === "BLOCKED" ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                    }`}>
                      {driver.status === "ACTIVE" ? "نشط" : driver.status === "BLOCKED" ? "محظور" : driver.status}
                    </span>
                    {driver.balance < 50 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                        رصيد غير كافٍ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <InfoRow emoji="📱" label="رقم الجوال" value={driver.mobile ?? "—"} ltr />
                <InfoRow
                  emoji="💰"
                  label="الرصيد"
                  value={`${driver.balance?.toFixed(2)} ريال`}
                  highlight={driver.balance < 50}
                />
                {driver.carType && <InfoRow emoji="🚗" label="نوع السيارة" value={driver.carType} />}
                {driver.nationality && <InfoRow emoji="🌐" label="الجنسية" value={driver.nationality} />}
                {driver.age && <InfoRow emoji="🎂" label="العمر" value={`${driver.age} سنة`} />}
                {driver.nationalId && <InfoRow emoji="🪪" label="رقم الهوية" value={driver.nationalId} ltr />}
                {driver.warningCount !== undefined && driver.warningCount > 0 && (
                  <InfoRow emoji="⚠️" label="التحذيرات" value={`${driver.warningCount} تحذير`} highlight />
                )}
                <InfoRow
                  emoji="📅"
                  label="تاريخ التسجيل"
                  value={driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("ar-SA") : "—"}
                />
              </div>
            </div>

            {/* ── Wallet Charge Card ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                    <Wallet size={18} className="text-violet-600" />
                  </div>
                  <p className="font-black text-gray-800">شحن المحفظة</p>
                </div>
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="text-sm font-bold text-white px-4 py-2 rounded-xl"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                >
                  + شحن جديد
                </button>
              </div>

              {bankAccounts.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 mb-2">💳 حسابات التحويل المتاحة:</p>
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="text-xs text-blue-800 mb-1">
                      <span className="font-bold">{acc.bankName}</span>
                      {" — "}
                      <span dir="ltr">{acc.iban}</span>
                      {" — "}
                      {acc.accountHolderName}
                    </div>
                  ))}
                </div>
              )}

              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">لا توجد معاملات شحن حتى الآن</p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{tx.amount.toFixed(2)} ريال</p>
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString("ar-SA")}</p>
                      </div>
                      {statusBadge(tx.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-400 mb-1">🔑 رمز تسجيل الدخول</p>
              <p className="text-xs text-gray-400">يُدار بواسطة الإدارة — تواصل معهم لتغيير رمزك</p>
            </div>
          </>
        )}
      </div>

      {/* ── Charge Modal ── */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-gray-900">طلب شحن المحفظة</p>
              <button onClick={() => { setShowChargeModal(false); setReceiptFile(null); setAmount(""); }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChargeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">المبلغ (ريال)</label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  dir="ltr"
                  className="rounded-xl border-gray-200 focus:border-violet-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5">إيصال التحويل</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
                {receiptFile ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-600" />
                      <span className="text-sm text-green-800 font-bold truncate max-w-[180px]">{receiptFile.name}</span>
                    </div>
                    <button type="button" onClick={() => setReceiptFile(null)}>
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-violet-300 transition-colors"
                  >
                    <Upload size={16} />
                    اضغط لإرفاق صورة الإيصال
                  </button>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <Clock size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">بعد الإرسال، ستتم مراجعة الطلب من قِبل الإدارة وإضافة الرصيد خلال 24 ساعة.</p>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
              >
                {uploading ? "جاري الإرسال..." : "إرسال طلب الشحن"}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

function InfoRow({ emoji, label, value, ltr, highlight }: { emoji: string; label: string; value: string; ltr?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-400">
        <span>{emoji}</span>
        {label}
      </span>
      <span className={`font-bold text-sm ${highlight ? "text-red-500" : "text-gray-800"}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
