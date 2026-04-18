import { useState, useRef } from "react";
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
import { PlusCircle, Pencil, Trash2, ShieldOff, ShieldCheck, AlertTriangle, RefreshCw, Banknote, RotateCcw, ChevronDown, ChevronUp, Upload, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import type { DriverDetail } from "@workspace/api-client-react";
import * as XLSX from "xlsx";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type DialogMode = "create" | "edit" | "balance" | "import" | null;

const STATUS_PILL: Record<string, string> = {
  ACTIVE:  "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
  DELETED: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "نشط", BLOCKED: "محظور", DELETED: "محذوف" };

type ParsedRow = {
  name: string;
  mobile: string;
  nationality: string;
  carType: string;
  carYear: string;
  loginCode: string;
  age: string;
  nationalId: string;
  city: string;
  _valid: boolean;
};

type ImportResult = {
  created: { name: string; mobile: string; loginCode: string }[];
  skipped: { name: string; mobile: string; reason: string }[];
};

function normalizeRow(raw: Record<string, unknown>): ParsedRow {
  const g = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v !== undefined && v !== "") return String(v).trim();
    }
    return "";
  };

  const name    = g("full_name", "name", "الاسم", "اسم السائق");
  const mobile  = g("phone", "mobile", "الجوال", "رقم الجوال", "الهاتف");
  const nationality = g("nationality", "الجنسية");
  const carType = g("car_type", "carType", "المركبة", "نوع السيارة");
  const carYear = g("car_year", "carYear", "سنة المركبة", "سنة السيارة");
  const loginCode = g("pin", "loginCode", "login_code", "الرمز", "كلمة المرور");
  const age     = g("age", "العمر");
  const nationalId = g("national_id", "nationalId", "رقم الهوية", "الهوية");
  const city    = g("city", "المدينة", "المنطقة");

  return {
    name, mobile, nationality, carType, carYear,
    loginCode, age, nationalId, city,
    _valid: !!(name && mobile),
  };
}

function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(json.map(normalizeRow));
      } catch {
        reject(new Error("تعذّر قراءة الملف. تأكد من أنه CSV أو Excel صحيح."));
      }
    };
    reader.onerror = () => reject(new Error("حدث خطأ أثناء قراءة الملف"));
    reader.readAsBinaryString(file);
  });
}

function ImportDriversDialog({ open, onClose, onImported }: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid);

  const reset = () => {
    setStep("upload");
    setRows([]);
    setResult(null);
    setParseError("");
    setImporting(false);
    setDragging(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (file: File) => {
    setParseError("");
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setParseError("يُقبل فقط ملفات CSV أو Excel (.xlsx / .xls)");
      return;
    }
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { setParseError("الملف فارغ أو لا يحتوي على بيانات"); return; }
      setRows(parsed);
      setStep("preview");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "خطأ في قراءة الملف");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      const payload = validRows.map((r) => ({
        name: r.name,
        mobile: r.mobile,
        nationality: r.nationality || undefined,
        carType: r.carType || undefined,
        carYear: r.carYear || undefined,
        loginCode: r.loginCode || undefined,
        age: r.age ? parseInt(r.age) : undefined,
        nationalId: r.nationalId || undefined,
      }));
      const res = await fetch(`${API}/api/admin/drivers/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drivers: payload }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      setStep("result");
      if (data.created?.length > 0) onImported();
    } catch {
      setParseError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-violet-600" />
            {step === "upload" && "استيراد سائقين من ملف"}
            {step === "preview" && `معاينة البيانات (${rows.length} صف)`}
            {step === "result" && "نتيجة الاستيراد"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="flex-1 space-y-5 py-2">
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-violet-500 bg-violet-50" : "border-gray-300 hover:border-violet-400 hover:bg-gray-50"}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-lg font-black text-gray-700">اسحب الملف هنا أو انقر للاختيار</p>
              <p className="text-base text-gray-400 mt-1">يُقبل: CSV • XLSX • XLS</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-base text-red-700 font-bold">
                <XCircle size={18} className="shrink-0 mt-0.5" /> {parseError}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="text-base font-black text-blue-800">أعمدة الملف المتوقعة:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["full_name", "الاسم الكامل ✱"],
                  ["phone", "رقم الجوال ✱"],
                  ["nationality", "الجنسية"],
                  ["car_type", "نوع المركبة"],
                  ["car_year", "سنة المركبة"],
                  ["pin", "رمز الدخول"],
                  ["age", "العمر"],
                  ["national_id", "رقم الهوية"],
                ].map(([col, label]) => (
                  <div key={col} className="bg-white rounded-xl border border-blue-100 px-3 py-2">
                    <p className="text-xs font-mono text-blue-600 font-bold">{col}</p>
                    <p className="text-sm text-gray-600">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-blue-600 mt-1">✱ إلزامي &nbsp;·&nbsp; يُقبل أيضاً الأسماء العربية كعناوين الأعمدة &nbsp;·&nbsp; رمز الدخول يُولَّد تلقائياً إذا لم يُحدَّد</p>
            </div>

            <div className="flex justify-end">
              <button onClick={handleClose} className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 text-base">إلغاء</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 py-2">
            {/* Summary bar */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-base font-black text-green-700">{validRows.length} صف صحيح</span>
              </div>
              {invalidRows.length > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <XCircle size={16} className="text-red-500" />
                  <span className="text-base font-black text-red-600">{invalidRows.length} صف ناقص (سيُتخطى)</span>
                </div>
              )}
            </div>

            {parseError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-base text-red-700 font-bold">
                <XCircle size={18} className="shrink-0 mt-0.5" /> {parseError}
              </div>
            )}

            {/* Preview table */}
            <div className="flex-1 overflow-auto border border-gray-200 rounded-2xl min-h-0">
              <table className="w-full text-sm" dir="rtl">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">#</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">الحالة</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">الاسم</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">الجوال</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">الجنسية</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">المركبة</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">السنة</th>
                    <th className="text-right px-4 py-3 font-black text-gray-600 whitespace-nowrap">الرمز</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${row._valid ? "hover:bg-gray-50" : "bg-red-50/60"}`}>
                      <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        {row._valid
                          ? <span className="inline-flex items-center gap-1 text-green-700 font-bold"><CheckCircle2 size={13} /> صحيح</span>
                          : <span className="inline-flex items-center gap-1 text-red-600 font-bold"><XCircle size={13} /> ناقص</span>}
                      </td>
                      <td className={`px-4 py-3 font-bold ${!row.name ? "text-red-500 italic" : "text-gray-900"}`}>{row.name || "—"}</td>
                      <td className={`px-4 py-3 font-medium ${!row.mobile ? "text-red-500 italic" : "text-gray-700"}`} dir="ltr">{row.mobile || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{row.nationality || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{row.carType || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{row.carYear || "—"}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">{row.loginCode || <span className="text-gray-300 italic text-xs">يُولَّد تلقائياً</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-between">
              <button onClick={reset} className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 text-base hover:bg-gray-50">
                ‹ تغيير الملف
              </button>
              <button
                onClick={handleConfirm}
                disabled={validRows.length === 0 || importing}
                className="px-8 py-2.5 rounded-xl text-white font-black text-base disabled:opacity-50 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
              >
                {importing ? (
                  <><RefreshCw size={16} className="animate-spin" /> جاري الاستيراد...</>
                ) : (
                  <>استيراد {validRows.length} سائق</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === "result" && result && (
          <div className="flex-1 space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                <CheckCircle2 size={32} className="mx-auto text-green-600 mb-2" />
                <p className="text-4xl font-black text-green-700">{result.created.length}</p>
                <p className="text-base font-bold text-green-600 mt-1">سائق أُضيف بنجاح</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                <XCircle size={32} className="mx-auto text-amber-500 mb-2" />
                <p className="text-4xl font-black text-amber-700">{result.skipped.length}</p>
                <p className="text-base font-bold text-amber-600 mt-1">صف مُتخطَّى</p>
              </div>
            </div>

            {result.created.length > 0 && (
              <div className="border border-green-200 rounded-2xl overflow-hidden">
                <div className="bg-green-50 px-4 py-2.5 border-b border-green-100">
                  <p className="text-sm font-black text-green-700">✅ السائقون المُضافون</p>
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">الاسم</th>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">الجوال</th>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">رمز الدخول</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.map((d, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 font-bold text-gray-900">{d.name}</td>
                          <td className="px-4 py-2 text-gray-600" dir="ltr">{d.mobile}</td>
                          <td className="px-4 py-2 font-mono font-bold text-violet-700">{d.loginCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="border border-amber-200 rounded-2xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100">
                  <p className="text-sm font-black text-amber-700">⚠️ الصفوف المُتخطاة</p>
                </div>
                <div className="max-h-44 overflow-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">الاسم</th>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">الجوال</th>
                        <th className="text-right px-4 py-2 text-xs font-black text-gray-500">السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skipped.map((d, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-600">{d.name}</td>
                          <td className="px-4 py-2 text-gray-500" dir="ltr">{d.mobile}</td>
                          <td className="px-4 py-2 text-amber-700 font-bold">{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              {result.skipped.length > 0 && result.created.length < rows.length && (
                <button onClick={reset} className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 text-base hover:bg-gray-50">
                  استيراد ملف آخر
                </button>
              )}
              <button onClick={handleClose}
                className="px-8 py-2.5 rounded-xl text-white font-black text-base"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                إغلاق
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900">السائقون</h1>
            <p className="text-gray-500 text-base mt-0.5">إدارة حسابات السائقين</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDialogMode("import")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-base border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors">
              <Upload size={17} /> استيراد ملف
            </button>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-base shadow-md"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
              <PlusCircle size={18} /> إضافة سائق
            </button>
          </div>
        </div>

        {isLoading && <div className="text-center py-20 text-gray-400 text-lg">جاري التحميل...</div>}

        {!isLoading && (!drivers || drivers.length === 0) && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-5xl mb-4">🚗</p>
            <p className="text-xl font-bold text-gray-600">لا يوجد سائقون</p>
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={() => setDialogMode("import")}
                className="px-5 py-2.5 rounded-xl font-bold text-base border border-violet-300 text-violet-700 bg-violet-50">
                <Upload size={15} className="inline ml-1" /> استيراد ملف
              </button>
              <button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white font-black text-base"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>إضافة أول سائق</button>
            </div>
          </div>
        )}

        {drivers && drivers.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">السائق</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الجوال</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">المركبة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الرصيد</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">الحالة</th>
                    <th className="text-right px-5 py-4 text-sm font-black text-gray-600">رمز الدخول</th>
                    <th className="text-center px-5 py-4 text-sm font-black text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, idx) => (
                    <tr key={d.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg shrink-0">🚗</div>
                          <div>
                            <p className="font-black text-gray-900 text-base">{d.name}</p>
                            <p className="text-xs text-gray-400">#{d.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-700" dir="ltr">{d.mobile}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{d.carType || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`text-sm font-black ${d.balance >= 50 ? "text-green-700" : "text-red-600"}`} dir="ltr">
                          {d.balance.toFixed(2)} ر.س
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm px-3 py-0.5 rounded-full font-bold w-fit ${STATUS_PILL[d.status] ?? ""}`}>
                            {STATUS_LABEL[d.status] ?? d.status}
                          </span>
                          {d.warningCount > 0 && (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold w-fit">{d.warningCount} تحذير</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-sm font-mono bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700">{d.loginCode}</code>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <Btn onClick={() => openEdit(d)} title="تعديل" icon={<Pencil size={13} />} />
                          <Btn onClick={() => openBalance(d)} title="الرصيد" icon={<Banknote size={13} />} />
                          <Btn onClick={() => handleRegenCode(d)} title="رمز جديد" icon={<RefreshCw size={13} />} />
                          {d.status === "ACTIVE" && <>
                            <Btn onClick={() => handleWarn(d)} title="تحذير" icon={<AlertTriangle size={13} />} color="amber" />
                            <Btn onClick={() => handleBlock(d)} title="حظر" icon={<ShieldOff size={13} />} color="red" />
                          </>}
                          {d.status === "BLOCKED" && <Btn onClick={() => handleUnblock(d)} title="رفع الحظر" icon={<ShieldCheck size={13} />} color="green" />}
                          <Btn onClick={() => handleDelete(d)} title="حذف" icon={<Trash2 size={13} />} color="red" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-400">
                إجمالي: <strong className="text-gray-700">{drivers.length}</strong> سائق
              </div>
            </div>

            {/* Mobile / tablet cards */}
            <div className="lg:hidden space-y-3">
              {drivers.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl shrink-0">🚗</div>
                        <div>
                          <p className="font-black text-gray-900 text-base">{d.name}</p>
                          <p className="text-sm text-gray-400" dir="ltr">{d.mobile}</p>
                        </div>
                        <span className={`text-sm px-3 py-0.5 rounded-full font-bold ${STATUS_PILL[d.status] ?? ""}`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </span>
                        {d.warningCount > 0 && (
                          <span className="text-sm text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold">{d.warningCount} تحذير</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 mr-12">
                        <span>رصيد: <strong className={d.balance >= 50 ? "text-green-700" : "text-red-600"} dir="ltr">{d.balance.toFixed(2)} ر.س</strong></span>
                        {d.carType && <span>{d.carType}</span>}
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">رمز: {d.loginCode}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Btn onClick={() => openEdit(d)} title="تعديل" icon={<Pencil size={14} />} />
                      <Btn onClick={() => openBalance(d)} title="الرصيد" icon={<Banknote size={14} />} />
                      <Btn onClick={() => handleRegenCode(d)} title="رمز جديد" icon={<RefreshCw size={14} />} />
                      {d.status === "ACTIVE" && <>
                        <Btn onClick={() => handleWarn(d)} title="تحذير" icon={<AlertTriangle size={14} />} color="amber" />
                        <Btn onClick={() => handleBlock(d)} title="حظر" icon={<ShieldOff size={14} />} color="red" />
                      </>}
                      {d.status === "BLOCKED" && <Btn onClick={() => handleUnblock(d)} title="رفع الحظر" icon={<ShieldCheck size={14} />} color="green" />}
                      <Btn onClick={() => handleDelete(d)} title="حذف" icon={<Trash2 size={14} />} color="red" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Deleted drivers toggle */}
        <div className="mt-5">
          <button onClick={() => setShowDeleted((p) => !p)}
            className="w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-500 text-base font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            {showDeleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showDeleted ? "إخفاء السائقين المحذوفين" : "عرض السائقين المحذوفين"}
          </button>
          {showDeleted && (
            <div className="mt-3 space-y-2">
              {loadingDeleted && <div className="text-center py-6 text-gray-400">جاري التحميل...</div>}
              {!loadingDeleted && (!deletedDrivers || deletedDrivers.length === 0) && (
                <div className="text-center py-8 border border-dashed rounded-xl"><p className="text-base text-gray-400">لا يوجد سائقون محذوفون</p></div>
              )}
              {deletedDrivers?.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-base text-gray-400">{d.name}</p>
                    <span dir="ltr" className="text-sm text-gray-300">{d.mobile}</span>
                  </div>
                  <button onClick={() => handleRestore(d)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-bold border border-blue-200">
                    <RotateCcw size={13} /> استرداد
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import dialog */}
      <ImportDriversDialog
        open={dialogMode === "import"}
        onClose={() => setDialogMode(null)}
        onImported={refetch}
      />

      {/* Create/Edit dialog */}
      <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{dialogMode === "create" ? "إضافة سائق جديد" : "تعديل بيانات السائق"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="الاسم الكامل"><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="اسم السائق" className="h-11 text-base" /></Field>
            <Field label="رقم الجوال"><Input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" className="h-11 text-base" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الجنسية (اختياري)"><Input value={formNationality} onChange={(e) => setFormNationality(e.target.value)} placeholder="سعودي" className="h-11 text-base" /></Field>
              <Field label="العمر (اختياري)"><Input type="number" min="18" max="70" value={formAge} onChange={(e) => setFormAge(e.target.value)} placeholder="35" dir="ltr" className="h-11 text-base" /></Field>
            </div>
            <Field label="رقم الهوية (اختياري)"><Input value={formNationalId} onChange={(e) => setFormNationalId(e.target.value)} placeholder="10xxxxxxxxx" dir="ltr" className="h-11 text-base" /></Field>
            <Field label="نوع المركبة (اختياري)"><Input value={formCar} onChange={(e) => setFormCar(e.target.value)} placeholder="تويوتا كامري 2022" className="h-11 text-base" /></Field>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse mt-2">
            <button onClick={dialogMode === "create" ? handleCreate : handleEdit}
              disabled={!formName.trim() || !formMobile.trim() || createDriver.isPending || updateDriver.isPending}
              className="flex-1 py-3 rounded-xl text-white font-black text-base disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
              {dialogMode === "create" ? "إضافة" : "حفظ"}
            </button>
            <button onClick={() => setDialogMode(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 text-base">إلغاء</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance dialog */}
      <Dialog open={dialogMode === "balance"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">تعديل رصيد {selectedDriver?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-base text-gray-500">الرصيد الحالي: <strong dir="ltr" className="text-gray-900">{selectedDriver?.balance.toFixed(2)} ر.س</strong></p>
          <Field label="المبلغ (+ إيداع / − خصم)">
            <Input value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="مثال: 100 أو -50" type="number" step="0.01" dir="ltr" className="h-11 text-base" />
          </Field>
          <DialogFooter className="gap-2 flex-row-reverse">
            <button onClick={handleBalance} disabled={!formBalance || updateBalance.isPending}
              className="flex-1 py-3 rounded-xl text-white font-black text-base disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>تأكيد</button>
            <button onClick={() => setDialogMode(null)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 text-base">إلغاء</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Btn({ onClick, title, icon, color }: { onClick: () => void; title: string; icon: React.ReactNode; color?: "red" | "amber" | "green" }) {
  const cls = color === "red" ? "text-red-500 border-red-200 hover:bg-red-50"
    : color === "amber" ? "text-amber-600 border-amber-200 hover:bg-amber-50"
    : color === "green" ? "text-green-600 border-green-200 hover:bg-green-50"
    : "text-gray-500 border-gray-200 hover:border-violet-400 hover:bg-violet-50";
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${cls}`}>
      {icon}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-bold text-sm text-gray-600">{label}</Label>
      {children}
    </div>
  );
}
