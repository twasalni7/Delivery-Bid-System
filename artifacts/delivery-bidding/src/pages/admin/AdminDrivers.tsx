import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListDrivers,
  useAdminCreateDriver,
  useAdminUpdateDriver,
  useAdminDeleteDriver,
  useAdminBlockDriver,
  useAdminUnblockDriver,
  useAdminWarnDriver,
  useAdminRestoreDriver,
  useAdminUpdateDriverBalance,
  useAdminRegenerateDriverCode,
  getAdminListDriversQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, ShieldOff, ShieldCheck, AlertTriangle, RefreshCw, Banknote } from "lucide-react";
import type { DriverDetail } from "@workspace/api-client-react";

type DialogMode = "create" | "edit" | "balance" | "code" | null;

export default function AdminDrivers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: drivers, isLoading } = useAdminListDrivers();
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
    setFormName(""); setFormMobile(""); setFormCar(""); setFormNationality(""); setFormAge(""); setFormNationalId(""); setFormBalance("");
    setSelectedDriver(null); setDialogMode("create");
  };

  const openEdit = (d: DriverDetail) => {
    setSelectedDriver(d); setFormName(d.name); setFormMobile(d.mobile ?? ""); setFormCar(d.carType ?? "");
    setFormNationality(d.nationality ?? ""); setFormAge(d.age ? String(d.age) : ""); setFormNationalId(d.nationalId ?? "");
    setDialogMode("edit");
  };

  const openBalance = (d: DriverDetail) => {
    setSelectedDriver(d); setFormBalance(""); setDialogMode("balance");
  };

  const handleCreate = () => {
    createDriver.mutate(
      {
        data: {
          name: formName.trim(),
          mobile: formMobile.trim(),
          carType: formCar.trim() || undefined,
          nationality: formNationality.trim() || undefined,
          age: formAge ? parseInt(formAge) : undefined,
          nationalId: formNationalId.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          refetch();
          toast({ title: `تم إنشاء السائق!`, description: `رمز الدخول: ${data.loginCode}` });
          setDialogMode(null);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "فشل الإنشاء";
          toast({ title: message, variant: "destructive" });
        },
      }
    );
  };

  const handleEdit = () => {
    if (!selectedDriver) return;
    updateDriver.mutate(
      {
        id: selectedDriver.id,
        data: {
          name: formName.trim(),
          mobile: formMobile.trim(),
          carType: formCar.trim() || undefined,
          nationality: formNationality.trim() || undefined,
          age: formAge ? parseInt(formAge) : undefined,
          nationalId: formNationalId.trim() || undefined,
        },
      },
      {
        onSuccess: () => { refetch(); toast({ title: "تم التحديث!" }); setDialogMode(null); },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "فشل التحديث";
          toast({ title: message, variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (d: DriverDetail) => {
    if (!confirm(`هل أنت متأكد من حذف ${d.name}؟`)) return;
    deleteDriver.mutate(
      { id: d.id },
      {
        onSuccess: () => { refetch(); toast({ title: "تم الحذف!" }); },
        onError: (err: Error) => toast({ title: err.message ?? "فشل الحذف", variant: "destructive" }),
      }
    );
  };

  const handleBlock = (d: DriverDetail) => {
    blockDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم الحظر" }); } });
  };

  const handleUnblock = (d: DriverDetail) => {
    unblockDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم رفع الحظر" }); } });
  };

  const handleWarn = (d: DriverDetail) => {
    warnDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم إصدار تحذير" }); } });
  };

  const handleRestore = (d: DriverDetail) => {
    restoreDriver.mutate({ id: d.id }, { onSuccess: () => { refetch(); toast({ title: "تم الاسترداد" }); } });
  };

  const handleBalance = () => {
    if (!selectedDriver) return;
    const amount = parseFloat(formBalance);
    if (isNaN(amount) || amount === 0) { toast({ title: "مبلغ غير صحيح", variant: "destructive" }); return; }
    updateBalance.mutate(
      { id: selectedDriver.id, data: { amount } },
      {
        onSuccess: (d) => { refetch(); toast({ title: "تم تعديل الرصيد!", description: `الرصيد الجديد: ${d.balance.toFixed(2)} ر.س` }); setDialogMode(null); },
        onError: (err: Error) => toast({ title: err.message ?? "فشل", variant: "destructive" }),
      }
    );
  };

  const handleRegenCode = (d: DriverDetail) => {
    regenCode.mutate({ id: d.id }, {
      onSuccess: (res) => { refetch(); toast({ title: "رمز جديد!", description: `الرمز: ${res.loginCode}` }); },
      onError: (err: Error) => toast({ title: err.message ?? "فشل", variant: "destructive" }),
    });
  };

  const STATUS_BADGE: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    BLOCKED: "bg-red-100 text-red-800 border-red-200",
    WARNED: "bg-amber-100 text-amber-800 border-amber-200",
    SUSPENDED: "bg-gray-100 text-gray-700 border-gray-200",
  };
  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "نشط", BLOCKED: "محظور", WARNED: "محذّر", SUSPENDED: "موقوف",
  };

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">السائقون</h1>
            <p className="text-muted-foreground text-sm mt-0.5">إدارة حسابات السائقين</p>
          </div>
          <Button className="font-bold" onClick={openCreate}>
            <PlusCircle size={16} className="ml-1" /> إضافة سائق
          </Button>
        </div>

        {isLoading && <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>}

        {!isLoading && (!drivers || drivers.length === 0) && (
          <div className="text-center py-20 border-2 border-dashed rounded-md">
            <p className="font-bold">لا يوجد سائقون</p>
            <Button className="mt-4 font-bold" onClick={openCreate}>إضافة أول سائق</Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {drivers?.map((d) => (
            <Card key={d.id} className="border-2">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-base">{d.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STATUS_BADGE[d.status] ?? ""}`}>
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                      {d.warningCount > 0 && (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                          {d.warningCount} تحذير
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span dir="ltr">{d.mobile}</span>
                      <span>رصيد: <strong dir="ltr">{d.balance.toFixed(2)} ر.س</strong></span>
                      {d.carType && <span>{d.carType}</span>}
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">رمز: {d.loginCode}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(d)} title="تعديل">
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openBalance(d)} title="تعديل الرصيد">
                      <Banknote size={13} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRegenCode(d)} title="رمز جديد">
                      <RefreshCw size={13} />
                    </Button>
                    {d.status === "ACTIVE" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleWarn(d)} title="تحذير" className="text-amber-600 border-amber-300 hover:bg-amber-50">
                          <AlertTriangle size={13} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleBlock(d)} title="حظر" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                          <ShieldOff size={13} />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleUnblock(d)} title="رفع الحظر" className="text-green-600 border-green-300 hover:bg-green-50">
                        <ShieldCheck size={13} />
                      </Button>
                    )}
                    {d.warningCount > 0 && (
                      <Button size="sm" variant="outline" onClick={() => handleRestore(d)} title="استرداد" className="text-blue-600 border-blue-300 hover:bg-blue-50">
                        استرداد
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleDelete(d)} title="حذف" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(o) => !o && setDialogMode(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{dialogMode === "create" ? "إضافة سائق جديد" : "تعديل بيانات السائق"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs">الاسم الكامل</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="اسم السائق" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs">رقم الجوال</Label>
                  <Input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">الجنسية (اختياري)</Label>
                    <Input value={formNationality} onChange={(e) => setFormNationality(e.target.value)} placeholder="سعودي" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">العمر (اختياري)</Label>
                    <Input type="number" min="18" max="70" value={formAge} onChange={(e) => setFormAge(e.target.value)} placeholder="35" dir="ltr" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs">رقم الهوية (اختياري)</Label>
                  <Input value={formNationalId} onChange={(e) => setFormNationalId(e.target.value)} placeholder="10xxxxxxxxx" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs">نوع المركبة (اختياري)</Label>
                  <Input value={formCar} onChange={(e) => setFormCar(e.target.value)} placeholder="مثال: تويوتا كامري 2022" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <Button onClick={dialogMode === "create" ? handleCreate : handleEdit} disabled={!formName.trim() || !formMobile.trim() || createDriver.isPending || updateDriver.isPending} className="font-bold">
                {dialogMode === "create" ? "إضافة" : "حفظ"}
              </Button>
              <Button variant="outline" onClick={() => setDialogMode(null)}>إلغاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogMode === "balance"} onOpenChange={(o) => !o && setDialogMode(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل رصيد {selectedDriver?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">الرصيد الحالي: <strong dir="ltr">{selectedDriver?.balance.toFixed(2)} ر.س</strong></p>
              <Label className="font-bold text-xs">المبلغ (+ إيداع / - خصم)</Label>
              <Input value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="مثال: 100 أو -50" type="number" step="0.01" dir="ltr" />
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <Button onClick={handleBalance} disabled={!formBalance || updateBalance.isPending} className="font-bold">تأكيد</Button>
              <Button variant="outline" onClick={() => setDialogMode(null)}>إلغاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
