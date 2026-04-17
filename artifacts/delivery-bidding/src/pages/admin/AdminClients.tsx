import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, User, Calendar } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Client = { id: number; name: string; mobile: string; createdAt: string };

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "خطأ في الخادم");
  return data;
}

export default function AdminClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["admin-clients"],
    queryFn: () => apiFetch("/api/admin/clients"),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setFormMobile("");
    setFormPassword("");
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditTarget(c);
    setFormName(c.name);
    setFormMobile(c.mobile);
    setFormPassword("");
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editTarget) {
        const body: Record<string, string> = {};
        if (formName) body.name = formName;
        if (formMobile) body.mobile = formMobile;
        if (formPassword) body.password = formPassword;
        return apiFetch(`/api/admin/clients/${editTarget.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        return apiFetch("/api/admin/clients", {
          method: "POST",
          body: JSON.stringify({ name: formName, mobile: formMobile, password: formPassword }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({ title: editTarget ? "تم تحديث العميل" : "تم إنشاء العميل" });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/admin/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({ title: "تم حذف العميل" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleDelete = (c: Client) => {
    if (!confirm(`هل تريد حذف العميل "${c.name}"؟ سيتم حذف حسابه نهائياً.`)) return;
    deleteMutation.mutate(c.id);
  };

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">إدارة العملاء</h1>
            <p className="text-muted-foreground text-sm mt-0.5">قائمة العملاء المسجّلين في المنصة</p>
          </div>
          <Button onClick={openCreate} className="font-bold gap-1">
            <Plus size={16} /> عميل جديد
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        )}

        {!isLoading && (!clients || clients.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed rounded-md">
            <p className="font-bold text-lg">لا يوجد عملاء</p>
            <Button onClick={openCreate} className="mt-4 font-bold">إضافة عميل</Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {(clients ?? []).map((c) => (
            <Card key={c.id} className="border-2">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-primary shrink-0" />
                      <span className="font-bold">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-2">#{c.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone size={13} className="text-primary shrink-0" />
                      <span dir="ltr">{c.mobile}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      {new Date(c.createdAt).toLocaleDateString("ar-SA")}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => handleDelete(c)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="font-bold text-xs">الاسم الكامل</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="اسم العميل"
                required={!editTarget}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-xs">رقم الجوال</Label>
              <Input
                value={formMobile}
                onChange={(e) => setFormMobile(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                required={!editTarget}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-xs">
                كلمة المرور {editTarget ? "(اتركها فارغة للإبقاء)" : ""}
              </Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="••••••••"
                required={!editTarget}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 font-bold" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
