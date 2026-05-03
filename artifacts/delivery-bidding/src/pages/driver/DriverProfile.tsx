import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useGetDriverMe, getGetDriverMeQueryKey, useListRequests } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Upload, CheckCircle2, Clock, X, Landmark, User, Phone, Car, Globe, CreditCard, AlertTriangle, TrendingUp } from "lucide-react";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" }, { query: { enabled: !!user, refetchInterval: 60_000 } as any });

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
    fetch(`${API}/api/wallet-transactions`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTransactions(data); })
      .catch(() => {});

    fetch(`${API}/api/bank-accounts`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBankAccounts(data); })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  if (isLoading) {
    return <Layout role="driver"><div className="text-center py-16 font-bold" style={{ color: "var(--text-hint)" }}>جاري التحميل...</div></Layout>;
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}><CheckCircle2 size={11} />مقبول</span>;
    if (status === "rejected") return <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>مرفوض</span>;
    return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}><Clock size={11} />قيد المراجعة</span>;
  };

  const mySelectedJobs = selectedRequests?.filter((r) => r.selectedDriverId === Number(user.id)) ?? [];
  const totalEarnings = mySelectedJobs.reduce((sum, r) => sum + ((r as any).monthlyPrice ?? 0), 0);
  const estimatedMonthlyTrips = mySelectedJobs.reduce((sum, r) => sum + ((r as any).workingDaysPerWeek ?? 5) * 4, 0);
  const avgPerTrip = estimatedMonthlyTrips > 0 ? Math.round(totalEarnings / estimatedMonthlyTrips) : 0;

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-5">

        {/* ── Hero Balance Card ── */}
        {driver && (
          <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>🚗</div>
                  <div>
                    <p className="text-white font-black text-xl">{driver.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                        style={driver.status === "ACTIVE"
                          ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }
                          : driver.status === "BLOCKED"
                          ? { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }
                          : { backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                        {driver.status === "ACTIVE" ? "✓ نشط" : driver.status === "BLOCKED" ? "محظور" : driver.status}
                      </span>
                      {driver.warningCount !== undefined && driver.warningCount > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                          ⚠️ {driver.warningCount} تحذير
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>رصيد المحفظة</p>
                  <p className="font-black" style={{ fontSize: "2.75rem", lineHeight: 1, color: "var(--brand)" }} dir="ltr">
                    {driver.balance?.toFixed(2)}
                    <span className="text-xl font-bold mr-2" style={{ color: "var(--brand)" }}>ر.س</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm min-h-[44px]"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  <Wallet size={16} />
                  شحن المحفظة
                </button>
              </div>

              {driver.balance < 50 && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <AlertTriangle size={16} className="shrink-0" style={{ color: "#f87171" }} />
                  <p className="text-xs font-bold" style={{ color: "#f87171" }}>
                    رصيدك أقل من 50 ريال — لا يمكنك تقديم عروض. اشحن محفظتك الآن.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {driver && (
          <>
            {/* ── Earnings Summary ── */}
            <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--brand-border)" }}>
              <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}>
                  <TrendingUp size={18} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <p className="font-black text-white">الأرباح الشهرية</p>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>إجمالي الدخل من الاشتراكات</p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-5xl font-black tracking-tight mb-4" style={{ color: "var(--brand)" }} dir="ltr">
                  {totalEarnings.toFixed(0)} <span className="text-2xl" style={{ color: "var(--brand)" }}>ريال</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "اشتراكات نشطة", value: String(mySelectedJobs.length) },
                    { label: "رحلات / شهر", value: estimatedMonthlyTrips > 0 ? String(estimatedMonthlyTrips) : "—" },
                    { label: "متوسط / رحلة", value: avgPerTrip > 0 ? `${avgPerTrip} ر.س` : "—" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                      <p className="font-black text-white text-base leading-tight">{s.value}</p>
                      <p className="text-[10px] mt-0.5 leading-tight font-bold" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bank Accounts for Transfer ── */}
            {bankAccounts.length > 0 && (
              <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
                    <Landmark size={18} style={{ color: "#60a5fa" }} />
                  </div>
                  <div>
                    <p className="font-black text-white">حسابات التحويل</p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>حوّل إليها للشحن ثم ارفع الإيصال</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-black text-white text-sm">{acc.bankName}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>للتحويل</span>
                      </div>
                      <p className="text-base font-mono font-bold mb-1" style={{ color: "var(--brand)" }} dir="ltr">{acc.iban}</p>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="shrink-0" style={{ color: "var(--text-hint)" }} />
                        <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{acc.accountHolderName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Wallet History ── */}
            <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                    <CreditCard size={18} style={{ color: "var(--status-frozen-text)" }} />
                  </div>
                  <div>
                    <p className="font-black text-white">سجل الشحن</p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>آخر طلبات شحن المحفظة</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChargeModal(true)}
                  className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl min-h-[36px]"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  + شحن جديد
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl mb-3">💳</div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>لا توجد معاملات شحن حتى الآن</p>
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold min-h-[40px]"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                  >
                    <Wallet size={14} />
                    ابدأ بشحن محفظتك
                  </button>
                </div>
              ) : (
                <div className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
                  {transactions.slice(0, 8).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <div>
                        <p className="font-black text-white text-base" dir="ltr">
                          {parseFloat(String(tx.amount)).toFixed(2)}
                          <span className="text-sm font-bold mr-1" style={{ color: "var(--text-muted)" }}>ر.س</span>
                        </p>
                        <p className="text-xs mt-0.5 font-bold" style={{ color: "var(--text-hint)" }}>
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
            <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3 p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--border-subtle)" }}>
                  <User size={18} style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="font-black text-white">بياناتي الشخصية</p>
              </div>
              <div className="p-5 space-y-1">
                {driver.mobile && (
                  <ProfileRow icon={<Phone size={15} style={{ color: "var(--text-hint)" }} />} label="رقم الجوال" value={driver.mobile} ltr />
                )}
                {driver.carType && (
                  <ProfileRow icon={<Car size={15} style={{ color: "var(--text-hint)" }} />} label="نوع السيارة" value={driver.carType} />
                )}
                {driver.nationality && (
                  <ProfileRow icon={<Globe size={15} style={{ color: "var(--text-hint)" }} />} label="الجنسية" value={driver.nationality} />
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
              <div className="mx-5 mb-5 p-3 rounded-xl flex items-center gap-2" style={{ backgroundColor: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                <span className="text-base">🔑</span>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>رمز تسجيل الدخول يُدار بواسطة الإدارة — تواصل معهم لتغييره</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Charge Modal ── */}
      {showChargeModal && (
        <div className="fixed inset-0 flex items-end justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-3xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }} dir="rtl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--brand-subtle)" }}>
                  <Wallet size={18} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <p className="font-black text-white">طلب شحن المحفظة</p>
                  <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>أرسل الإيصال بعد التحويل</p>
                </div>
              </div>
              <button
                onClick={() => { setShowChargeModal(false); setReceiptFile(null); setAmount(""); }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-sub)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Bank accounts inside modal */}
              {bankAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Landmark size={13} />
                    حوّل المبلغ إلى أحد هذه الحسابات أولاً:
                  </p>
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="p-3 rounded-xl" style={{ backgroundColor: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-black text-white text-sm">{acc.bankName}</p>
                      </div>
                      <p className="text-sm font-mono font-bold" style={{ color: "var(--brand)" }} dir="ltr">{acc.iban}</p>
                      <p className="text-xs mt-0.5 font-bold" style={{ color: "var(--text-muted)" }}>{acc.accountHolderName}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChargeSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>المبلغ المحوّل (ريال)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    dir="ltr"
                    className="input-dark w-full text-lg font-bold h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold block mb-2" style={{ color: "var(--text-sub)" }}>إيصال التحويل (صورة)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {receiptFile ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl min-h-[48px]"
                      style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="shrink-0" style={{ color: "#34d399" }} />
                        <span className="text-sm font-bold truncate max-w-[180px]" style={{ color: "#34d399" }}>{receiptFile.name}</span>
                      </div>
                      <button type="button" onClick={() => setReceiptFile(null)} style={{ color: "var(--text-hint)" }}>
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl text-sm min-h-[52px] transition-colors"
                      style={{ border: "2px dashed var(--border)", color: "var(--text-muted)" }}
                    >
                      <Upload size={18} />
                      اضغط لإرفاق صورة الإيصال
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                  <Clock size={14} className="mt-0.5 shrink-0" style={{ color: "#fbbf24" }} />
                  <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>سيتم مراجعة الطلب من قِبل الإدارة وإضافة الرصيد خلال 24 ساعة.</p>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full btn-primary disabled:opacity-50 min-h-[52px] text-base"
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
    <div className="flex items-center justify-between gap-2 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
        {icon}
        {label}
      </span>
      <span className="font-black text-sm text-white" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
