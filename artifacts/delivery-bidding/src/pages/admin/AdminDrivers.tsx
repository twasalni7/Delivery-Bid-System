import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useAdminListDrivers, useAdminCreateDriver, useAdminUpdateDriver, useAdminDeleteDriver,
  useAdminBlockDriver, useAdminUnblockDriver, useAdminWarnDriver, useAdminRestoreDriver,
  useAdminUpdateDriverBalance, useAdminRegenerateDriverCode, getAdminListDriversQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, ShieldOff, ShieldCheck, AlertTriangle, RefreshCw, Banknote, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { DriverDetail } from "@workspace/api-client-react";

type DialogMode = "create" | "edit" | "balance" | null;

const STATUS_PILL: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
  DELETED: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "نشط", BLOCKED: "محظور", DELETED: "محذوف" };

export default function AdminDrivers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: drivers, isLoading } = useAdminListDrivers();
  const { data: deletedDrivers, isLoading: loadingDeleted, refetch: refetchDeleted } = useQuery<DriverDetail[]>({
    queryKey: ["admin-drivers-deleted"],
    queryFn: () => fetch("/api/admin/drivers?status=DELETED", { credentials: "include" }).then((r) => r.json()),
    enabled: showDeleted,
  });
  const createDriver = useAdminCreateDriver();
  const updateDriver = useAdminUpdateDriver();
  const deleteDriver = useAdminDeleteDriver();
  const blockDriver = useAdminBlockDriver();
  const unblockDriver = useAdminUnblockDriver();
  const warnDriver = useAdminWarnDriver();
  const restoreDriver = useAdminRestoreDriver();
  const updateBalance = useAdminUpdateDriverBalance();
  const regenCode = useAdminRegenerateDriverCode();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverDetail | null>(null);
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formCar, setFormCar] = useState("");
  const [formNationality, setFormNationality] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formNationalId, setFormNationalId] = useState("");
  const [formBalance, setFormBalance] = useState("");

  const refetch = () => queryClient.invalidateQueries({ queryKey: getAdminListDriversQueryKey() });

  const openCreate = () => {
    setFormName(""); setFormMobile(""); setFormCar(""); setFormNationality(""); setFormAge(""); setFormNationalId("");
    setSelectedDriver(null); setDialogMode("create");
  };
  const openEdit = (d: DriverDetail) => {
    setSelectedDriver(d); setFormName(d.name); setFormMobile(d.mobile ?? ""); setFormCar(d.carType ?? "");
    setFormNationality(d.nationality ?? ""); setFormAge(d.age ? String(d.age) : ""); setFormNationalId(d.nationalId ?? "");
    setDialogMode("edit");
  };
  const openBalance = (d: DriverDetail) => { setSelectedDriver(d); setFormBalance(""); setDialogMode("balance"); };

  const handleCreate = () => {
    createDriver.mutate(
      { data: { name: formName.trim(), mobile: formMobile.trim(), carType: formCar.trim() || undefined, nationality: formNationality.trim() || undefined, age: formAge ? parseInt(formAge) : undefined, nationalId: formNationalId.trim() || undefined } },
      {
        onSuccess: (data) => { refetch(); toast({ title: "تم إنشاء السائق!", description: `رمز الدخول: ${data.loginCode}` }); setDialogMode(null); },
        onError: (err: unknown) => toast({ title: err instanceof Error ? err.message : "فشل الإنشاء", variant: "destructive" }),
      }
    );
  };
  const handleEdit = () => {
    if (!selectedDriver) return;
    updateDriver.mutate(
      { id: selectedDriver.id, data: { name: formName.trim(), mobile: formMobile.trim(), carType: formCar.trim() || undefined, nationality: formNationality.trim() || undefined, age: formAge ? parseInt(formAge) : undefined, nationalId: formNationalId.trim() || undefined } },
      {
        onSuccess: () => { refetch(); toast({ title: "تم التحديث!" }); setDialogMode(null); },
        onError: (err: unknown) => toast({ title: err instanceof Error ? err.message : "فشل التحديث", variant: "destructive" }),
      }
    );
  };
  const handleDelete = (d: DriverDetail) => {
    if (!confirm(`هل أنت متأكد من حذف ${d.name}؟`)) return;
    deleteDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم الحذف!" }); }, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) });
  };
  const handleBlock = (d: DriverDetail) => {
    if (!confirm(`هل تريد حظر "${d.name}"؟`)) return;
    blockDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم الحظر" }); } });
  };
  const handleUnblock = (d: DriverDetail) => {
    if (!confirm(`هل تريد رفع الحظر عن "${d.name}"؟`)) return;
    unblockDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم رفع الحظر" }); } });
  };
  const handleWarn = (d: DriverDetail) => {
    if (!confirm(`إصدار تحذير للسائق "${d.name}"؟`)) return;
    warnDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم إصدار تحذير" }); } });
  };
  const handleBalance = () => {
    if (!selectedDriver) return;
    const amount = parseFloat(formBalance);
    if (isNaN(amount) || amount === 0) { toast({ title: "مبلغ غير صحيح", variant: "destructive" }); return; }
    updateBalance.mutate(
      { id: selectedDriver.id, data: { amount } },
      { onSuccess: (d) => { refetch(); toast({ title: "تم تعديل الرصيد!", description: `الرصيد الجديد: ${d.balance.toFixed(2)} ر.س` }); setDialogMode(null); }, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) }
    );
  };
  const handleRegenCode = (d: DriverDetail) => {
    regenCode.mutate({ id: d.id }, { onSuccess: (res) => { refetch(); toast({ title: "رمز جديد!", description: `الرمز: ${res.loginCode}` }); }, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) });
  };
  const handleRestore = (d: DriverDetail) => {
    restoreDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); void refetchDeleted(); toast({ title: "تم استرداد السائق" }); }, onError: (err: Error) => toast({ title: err.message, variant: "destructive" }) });
  };

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">السائقون</h1>
            <p className="text-gray-400 text-sm">إدارة حسابات السائقين</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-black shadow-md"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
            <PlusCircle size={16} /> إضافة سائق
          </button>
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {!isLoading && (!drivers || drivers.length === 0) && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🚗</p>
            <p className="font-bold text-gray-500">لا يوجد سائقون</p>
            <button onClick={openCreate} className="mt-4 px-5 py-2.5 rounded-xl text-white font-black"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
              إضافة أول سائق
            </button>
          </div>
        )}

        <div className="space-y-3">
          {drivers?.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-lg shrink-0">🚗</div>
                    <p className="font-black text-gray-900">{d.name}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${STATUS_PILL[d.status] ?? ""}`}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                    {d.warningCount > 0 && (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">{d.warningCount} تحذير</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400 mr-11">
                    <span dir="ltr">{d.mobile}</span>
                    <span>رصيد: <strong className="text-gray-700" dir="ltr">{d.balance.toFixed(2)} ر.س</strong></span>
                    {d.carType && <span>{d.carType}</span>}
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">رمز: {d.loginCode}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <ActionBtn onClick={() => openEdit(d)} title="تعديل" icon={<Pencil size={13} />} />
                  <ActionBtn onClick={() => openBalance(d)} title="الرصيد" icon={<Banknote size={13} />} />
                  <ActionBtn onClick={() => handleRegenCode(d)} title="رمز جديد" icon={<RefreshCw size={13} />} />
                  {d.status === "ACTIVE" && <>
                    <ActionBtn onClick={() => handleWarn(d)} title="تحذير" icon={<AlertTriangle size={13} />} color="amber" />
                    <ActionBtn onClick={() => handleBlock(d)} title="حظر" icon={<ShieldOff size={13} />} color="red" />
                  </>}
                  {d.status === "BLOCKED" && <ActionBtn onClick={() => handleUnblock(d)} title="رفع الحظر" icon={<ShieldCheck size={13} />} color="green" />}
                  <ActionBtn onClick={() => handleDelete(d)} title="حذف" icon={<Trash2 size={13} />} color="red" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={() => setShowDeleted((p) => !p)}
            className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-bold flex items-center justify-center gap-2">
            {showDeleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showDeleted ? "إخفاء السائقين المحذوفين" : "عرض السائقين المحذوفين"}
          </button>
          {showDeleted && (
            <div className="mt-3 space-y-2">
              {loadingDeleted && <div className="text-center py-6 text-gray-400 text-sm">جاري التحميل...</div>}
              {!loadingDeleted && (!deletedDrivers || deletedDrivers.length === 0) && (
                <div className="text-center py-8 border border-dashed rounded-xl"><p className="text-sm text-gray-400">لا يوجد سائقون محذوفون</p></div>
              )}
              {deletedDrivers?.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1"><p className="font-bold text-sm text-gray-400">{d.name}</p><span dir="ltr" className="text-xs text-gray-300">{d.mobile}</span></div>
                  <button onClick={() => handleRestore(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">
                    <RotateCcw size={12} /> استرداد
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(o) => !o && setDialogMode(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{dialogMode === "create" ? "إضافة سائق جديد" : "تعديل بيانات السائق"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="الاسم الكامل"><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="اسم السائق" /></Field>
              <Field label="رقم الجوال"><Input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الجنسية (اختياري)"><Input value={formNationality} onChange={(e) => setFormNationality(e.target.value)} placeholder="سعودي" /></Field>
                <Field label="العمر (اختياري)"><Input type="number" min="18" max="70" value={formAge} onChange={(e) => setFormAge(e.target.value)} placeholder="35" dir="ltr" /></Field>
              </div>
              <Field label="رقم الهوية (اختياري)"><Input value={formNationalId} onChange={(e) => setFormNationalId(e.target.value)} placeholder="10xxxxxxxxx" dir="ltr" /></Field>
              <Field label="نوع المركبة (اختياري)"><Input value={formCar} onChange={(e) => setFormCar(e.target.value)} placeholder="تويوتا كامري 2022" /></Field>
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <button onClick={dialogMode === "create" ? handleCreate : handleEdit}
                disabled={!formName.trim() || !formMobile.trim() || createDriver.isPending || updateDriver.isPending}
                className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                {dialogMode === "create" ? "إضافة" : "حفظ"}
              </button>
              <button onClick={() => setDialogMode(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600">إلغاء</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogMode === "balance"} onOpenChange={(o) => !o && setDialogMode(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل رصيد {selectedDriver?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-400">الرصيد الحالي: <strong dir="ltr">{selectedDriver?.balance.toFixed(2)} ر.س</strong></p>
            <Field label="المبلغ (+ إيداع / - خصم)">
              <Input value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="مثال: 100 أو -50" type="number" step="0.01" dir="ltr" />
            </Field>
            <DialogFooter className="gap-2 flex-row-reverse">
              <button onClick={handleBalance} disabled={!formBalance || updateBalance.isPending}
                className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>تأكيد</button>
              <button onClick={() => setDialogMode(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600">إلغاء</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function ActionBtn({ onClick, title, icon, color }: { onClick: () => void; title: string; icon: React.ReactNode; color?: "red" | "amber" | "green" }) {
  const cls = color === "red" ? "text-red-500 border-red-200 hover:bg-red-50"
    : color === "amber" ? "text-amber-600 border-amber-200 hover:bg-amber-50"
    : color === "green" ? "text-green-600 border-green-200 hover:bg-green-50"
    : "text-gray-500 border-gray-200 hover:border-violet-400";
  return (
    <button onClick={onClick} title={title}
      className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${cls}`}>
      {icon}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-bold text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
