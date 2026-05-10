import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
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
  const [items, setItems] = useState<ArchivedRequest[]>([]);

  useEffect(() => {
    fetch(`${API}/api/admin/requests/archive`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  return (
    <Layout role="admin">
      <div dir="rtl" className="space-y-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>أرشيف الطلبات</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>الطلبات المكتملة أو الملغاة المؤرشفة تلقائياً</p>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/admin/requests/${item.id}`}>
              <div className="rounded-2xl p-4 cursor-pointer" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="font-black" style={{ color: "var(--text)" }}>#{item.id} — {item.homeLocation} ← {item.workLocation}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{item.client?.name ?? "بدون عميل"} • {item.monthlyPrice.toFixed(0)} ر.س</p>
              </div>
            </Link>
          ))}
          {items.length === 0 && <div className="rounded-2xl p-6 text-sm font-bold" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>لا توجد طلبات مؤرشفة</div>}
        </div>
      </div>
    </Layout>
  );
}
