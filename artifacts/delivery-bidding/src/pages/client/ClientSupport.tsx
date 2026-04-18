import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LifeBuoy, Plus, Clock, CheckCircle, X, AlertCircle } from "lucide-react";
import { getTicketStatusColor, getTicketStatusLabel } from "@/lib/status-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const TICKET_TYPES = ["تأخير", "دفع", "إلغاء", "أخرى"] as const;

type Ticket = {
  id: number;
  type: string;
  message: string;
  status: string;
  adminReply: string | null;
  requestId: number | null;
  createdAt: string;
  updatedAt: string;
};

function useMyTickets() {
  return useQuery<Ticket[]>({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets/my`, { credentials: "include" });
      if (!r.ok) throw new Error("فشل تحميل التذاكر");
      return r.json();
    },
  });
}

export default function ClientSupport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tickets = [], isLoading } = useMyTickets();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<string>("أخرى");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/support-tickets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, requestId: requestId ? Number(requestId) : undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "فشل الإرسال");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      toast({ title: "تم إرسال تذكرتك", description: "سيتم الرد عليك قريباً" });
      setShowForm(false);
      setMessage("");
      setType("أخرى");
      setRequestId("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Layout role="client">
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-full p-2">
              <LifeBuoy size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">الدعم والمساعدة</h1>
              <p className="text-sm text-muted-foreground">تواصل معنا عند أي مشكلة</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" className="font-bold gap-1">
            <Plus size={15} /> تذكرة جديدة
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">إرسال تذكرة دعم</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">نوع المشكلة</Label>
                <div className="flex gap-2 flex-wrap">
                  {TICKET_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        type === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted border-border hover:border-primary"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">رقم الطلب (اختياري)</Label>
                <input
                  type="number"
                  placeholder="مثال: 42"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">اشرح مشكلتك</Label>
                <Textarea
                  placeholder="اكتب تفاصيل مشكلتك هنا..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">إلغاء</Button>
                <Button
                  onClick={() => submit.mutate()}
                  disabled={!message.trim() || submit.isPending}
                  className="flex-1 font-bold"
                >
                  {submit.isPending ? "جاري الإرسال..." : "إرسال التذكرة"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <LifeBuoy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">لا توجد تذاكر دعم بعد</p>
            <p className="text-sm mt-1">اضغط "تذكرة جديدة" لإرسال استفسارك</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <Card key={t.id} className="border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-sm">{t.type}</span>
                        {t.requestId && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            طلب #{t.requestId}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getTicketStatusColor(t.status)}`}>
                          {getTicketStatusLabel(t.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{t.message}</p>
                      {t.adminReply && (
                        <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 mt-2">
                          <p className="text-xs font-bold text-green-700 mb-1">رد الإدارة:</p>
                          <p className="text-sm text-green-800">{t.adminReply}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-left">
                      #{t.id}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
