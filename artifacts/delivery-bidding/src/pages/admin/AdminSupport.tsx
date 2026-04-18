import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LifeBuoy, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Ticket = {
  id: number;
  clientId: number | null;
  driverId: number | null;
  requestId: number | null;
  type: string;
  message: string;
  status: string;
  adminReply: string | null;
  submitterName: string | null;
  createdAt: string;
  updatedAt: string;
};

const TICKET_STATUSES = [
  { value: "OPEN", label: "مفتوحة" },
  { value: "IN_PROGRESS", label: "قيد المعالجة" },
  { value: "RESOLVED", label: "تم الحل" },
  { value: "CLOSED", label: "مغلقة" },
];

function useAllTickets() {
  return useQuery<Ticket[]>({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, { credentials: "include" });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
  });
}

export default function AdminSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useAllTickets();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const update = useMutation({
    mutationFn: async ({ id, adminReply, status }: { id: number; adminReply?: string; status?: string }) => {
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply, status }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "فشل التحديث");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "تم تحديث التذكرة" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/support-tickets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "تم حذف التذكرة" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = filterStatus === "ALL" ? tickets : tickets.filter((t) => t.status === filterStatus);

  return (
    <Layout role="admin">
      <div className="max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <LifeBuoy size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black">تذاكر الدعم</h1>
            <p className="text-sm text-muted-foreground">
              {tickets.length} تذكرة | {tickets.filter((t) => t.status === "OPEN").length} مفتوحة
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              filterStatus === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
            }`}
          >
            الكل
          </button>
          {TICKET_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                filterStatus === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <LifeBuoy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">لا توجد تذاكر</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const isOpen = expanded === t.id;
              return (
                <Card key={t.id} className="border">
                  <CardContent className="pt-4 pb-3">
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : t.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm">{t.type}</span>
                          {t.submitterName && (
                            <span className="text-xs text-muted-foreground">— {t.submitterName}</span>
                          )}
                          {t.requestId && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">طلب #{t.requestId}</span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getTicketStatusColor(t.status)}`}>
                            {getTicketStatusLabel(t.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{t.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">#{t.id}</span>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-bold text-muted-foreground mb-1">رسالة المستخدم:</p>
                          <p className="text-sm">{t.message}</p>
                        </div>

                        {t.adminReply && (
                          <div className="bg-green-50 border border-green-200 rounded-md p-3">
                            <p className="text-xs font-bold text-green-700 mb-1">ردك السابق:</p>
                            <p className="text-sm text-green-800">{t.adminReply}</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="font-bold text-xs">الرد على التذكرة</Label>
                          <Textarea
                            placeholder="اكتب ردك هنا..."
                            value={replies[t.id] ?? t.adminReply ?? ""}
                            onChange={(e) => setReplies((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            rows={3}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="font-bold text-xs">تغيير الحالة</Label>
                          <div className="flex gap-2 flex-wrap">
                            {TICKET_STATUSES.map((s) => (
                              <button
                                key={s.value}
                                onClick={() => update.mutate({ id: t.id, status: s.value })}
                                disabled={t.status === s.value || update.isPending}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                                  t.status === s.value
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted border-border hover:border-primary"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 font-bold"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({
                                id: t.id,
                                adminReply: replies[t.id] ?? t.adminReply ?? undefined,
                              })
                            }
                          >
                            حفظ الرد
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              if (confirm("هل تريد حذف هذه التذكرة؟")) {
                                remove.mutate(t.id);
                                setExpanded(null);
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
