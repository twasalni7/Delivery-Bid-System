import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

type ArchivedRequest = {
  id: number;
  status: string;
  homeLocation: string;
  workLocation: string;
  monthlyPrice: number;
  archivedAt: string | null;
  client?: { id: number; name: string; mobile: string } | null;
};

export default function AdminArchive() {
  const { toast } = useToast();
  const [items, setItems] = useState<ArchivedRequest[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/admin/requests/archive`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch((err) => {
        console.error("Failed to fetch archive:", err);
        setError(true);
        toast({ title: "فشل تحميل الأرشيف", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <Layout role="admin">
      <div dir="rtl" className="space-y-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>أرشيف الطلبات</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>الطلبات المكتملة أو الملغاة المؤرشفة تلقائياً</p>
        </div>

        {loading ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>جاري التحميل...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--status-cancelled-bg)", border: "1px solid var(--status-cancelled-border)" }}>
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-black mb-2" style={{ color: "var(--status-cancelled-text)" }}>فشل تحميل الأرشيف</p>
            <p className="text-sm mb-4" style={{ color: "var(--status-cancelled-text)" }}>يرجى التحقق من اتصال الشبكة والمحاولة مرة أخرى</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link key={item.id} href={`/admin/requests/${item.id}`}>
                <div className="rounded-2xl p-4 cursor-pointer transition-colors hover:bg-opacity-80" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="font-black" style={{ color: "var(--text)" }}>#{item.id} — {item.homeLocation} ← {item.workLocation}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{item.client?.name ?? "بدون عميل"} • {item.monthlyPrice.toFixed(0)} ر.س</p>
                </div>
              </Link>
            ))}
            {items.length === 0 && (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-4xl mb-3">📦</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>لا توجد طلبات مؤرشفة</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
