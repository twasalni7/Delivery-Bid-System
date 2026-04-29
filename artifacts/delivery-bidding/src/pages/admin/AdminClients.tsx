import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";

import { API_ORIGIN as API } from "@/lib/api-config";
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
    refetchInterval: 30_000,
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) || c.mobile.includes(q) || String(c.id).includes(q)
    );
  }, [clients, search]);

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
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black text-white">العملاء</h1>
            <p className="text-base mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {clients ? `${filtered.length} من ${clients.length} عميل` : "قائمة العملاء المسجّلين"}
            </p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-base"
            style={{ backgroundColor: "#deff9a", color: "#000" }}>
            <Plus size={18} /> عميل جديد
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-colors mb-5" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search size={17} className="text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="ابحث بالاسم، رقم الجوال، أو الرقم التعريفي..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-base bg-transparent outline-none text-white placeholder-gray-600"
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "rgba(255,255,255,0.3)" }}><X size={15} /></button>
          )}
        </div>

        {isLoading && <div className="text-center py-20 text-lg" style={{ color: "rgba(255,255,255,0.45)" }}>جاري التحميل...</div>}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-24 rounded-2xl" style={{ border: "2px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-5xl mb-4">{search ? "🔍" : "👤"}</p>
            <p className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{search ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء"}</p>
            {search ? (
              <button onClick={() => setSearch("")} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>مسح البحث</button>
            ) : (
              <button onClick={openCreate} className="mt-5 px-6 py-3 rounded-xl font-black text-base"
                style={{ backgroundColor: "#deff9a", color: "#000" }}>إضافة عميل</button>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full" dir="rtl">
                <thead>
                  <tr style={{ backgroundColor: "#1a1a1a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th className="text-right px-5 py-4 text-sm font-black w-12" style={{ color: "rgba(255,255,255,0.45)" }}>#</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "rgba(255,255,255,0.45)" }}>الاسم</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "rgba(255,255,255,0.45)" }}>رقم الجوال</th>
                    <th className="text-right px-5 py-4 text-sm font-black" style={{ color: "rgba(255,255,255,0.45)" }}>تاريخ التسجيل</th>
                    <th className="text-center px-5 py-4 text-sm font-black" style={{ color: "rgba(255,255,255,0.45)" }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.02)" : undefined }}>
                      <td className="px-5 py-4 text-sm font-mono font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>#{c.id}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "rgba(222,255,154,0.1)" }}>👤</div>
                          <p className="font-black text-white text-base">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }} dir="ltr">{c.mobile}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {new Date(c.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(c)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(c)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 text-sm" style={{ backgroundColor: "#1a1a1a", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                يُعرض <strong className="text-white">{filtered.length}</strong> من <strong className="text-white">{clients?.length ?? 0}</strong> عميل
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((c) => (
                <div key={c.id} className="rounded-2xl p-4" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: "rgba(222,255,154,0.1)" }}>👤</div>
                      <div>
                        <p className="font-black text-white text-base">{c.name} <span className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>#{c.id}</span></p>
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }} dir="ltr">{c.mobile}</p>
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(c.createdAt).toLocaleDateString("ar-SA")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(c)} className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(c)} className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">{editTarget ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>الاسم الكامل</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="اسم العميل" required={!editTarget} className="h-11 text-base rounded-xl outline-none" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>رقم الجوال</Label>
              <Input value={formMobile} onChange={(e) => setFormMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" required={!editTarget} className="h-11 text-base rounded-xl outline-none" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>كلمة المرور {editTarget ? "(اتركها فارغة للإبقاء)" : ""}</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" required={!editTarget} className="h-11 text-base rounded-xl outline-none" style={{ backgroundColor: "#111111", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saveMutation.isPending}
                className="flex-1 py-3 rounded-xl font-black text-base disabled:opacity-50"
                style={{ backgroundColor: "#deff9a", color: "#000" }}>
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button type="button" onClick={() => setDialogOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-base" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>إلغاء</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
