import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

type ArchivedRequest = { id: number; homeLocation: string; workLocation: string; status: string; archivedAt: string | null };

export default function DriverArchive() {
  const [items, setItems] = useState<ArchivedRequest[]>([]);

  useEffect(() => {
    fetch(`${API}/api/drivers/me/requests?archived=true`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  return (
    <Layout role="driver">
      <div dir="rtl" className="space-y-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>الأرشيف</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>طلباتك القديمة المؤرشفة</p>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/driver/request/${item.id}`}>
              <div className="rounded-2xl p-4 cursor-pointer" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="font-black" style={{ color: "var(--text)" }}>#{item.id} — {item.homeLocation} ← {item.workLocation}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{item.status}</p>
              </div>
            </Link>
          ))}
          {items.length === 0 && <div className="rounded-2xl p-6 text-sm font-bold" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>لا توجد طلبات في الأرشيف</div>}
        </div>
      </div>
    </Layout>
  );
}
