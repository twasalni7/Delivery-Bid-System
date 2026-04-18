import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
type Client = { id: number; name: string; mobile: string; createdAt: string };

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
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

  const openCreate = () => { setEditTarget(null); setFormName(""); setFormMobile(""); setFormPassword(""); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditTarget(c); setFormName(c.name); setFormMobile(c.mobile); setFormPassword(""); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editTarget) {
        const body: Record<string, string> = {};
        if (formName) body.name = formName;
        if (formMobile) body.mobile = formMobile;
        if (formPassword) body.password = formPassword;
        return apiFetch(`/api/admin/clients/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        return apiFetch("/api/admin/clients", { method: "POST", body: JSON.stringify({ name: formName, mobile: formMobile, password: formPassword }) });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-clients"] }); toast({ title: editTarget ? "تم تحديث العميل" : "تم إنشاء العميل" }); setDialogOpen(false); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-clients"] }); toast({ title: "تم حذف العميل" }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const handleDelete = (c: Client) => {
    if (!confirm(`هل تريد حذف العميل "${c.name}"؟`)) return;
    deleteMutation.mutate(c.id);
  };

  return (
    <Layout role="admin">
      <div dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900">إدارة العملاء</h1>
            <p className="text-gray-400 text-sm">قائمة العملاء المسجّلين في المنصة</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-black shadow-md"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
            <Plus size={16} /> عميل جديد
          </button>
        </div>

        {isLoading && <div className="text-center py-16 text-gray-400">جاري التحميل...</div>}

        {!isLoading && (!clients || clients.length === 0) && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-bold text-gray-500">لا يوجد عملاء</p>
            <button onClick={openCreate} className="mt-4 px-5 py-2.5 rounded-xl text-white font-black"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>إضافة عميل</button>
          </div>
        )}

        <div className="space-y-3">
          {(clients ?? []).map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">👤</div>
                  <div>
                    <p className="font-black text-gray-900">{c.name} <span className="text-xs text-gray-300 font-mono">#{c.id}</span></p>
                    <p className="text-xs text-gray-400" dir="ltr">{c.mobile}</p>
                    <p className="text-xs text-gray-300">{new Date(c.createdAt).toLocaleDateString("ar-SA")}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(c)}
                    className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-violet-400 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(c)}
                    className="w-8 h-8 rounded-xl border border-red-200 bg-red-50 flex items-center justify-center text-red-500 hover:border-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-gray-500">الاسم الكامل</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="اسم العميل" required={!editTarget} className="rounded-xl border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-gray-500">رقم الجوال</Label>
              <Input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" required={!editTarget} className="rounded-xl border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-gray-500">كلمة المرور {editTarget ? "(اتركها فارغة للإبقاء)" : ""}</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" required={!editTarget} className="rounded-xl border-gray-200" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button type="button" onClick={() => setDialogOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600">إلغاء</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
