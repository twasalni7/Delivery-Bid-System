import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

type ArchivedRequest = { id: number; homeLocation: string; workLocation: string; status: string; archivedAt: string | null };

export default function ClientArchive() {
  const [items, setItems] = useState<ArchivedRequest[]>([]);

  useEffect(() => {
    fetch(`${API}/api/requests?archived=true`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setItems(list.filter((item: ArchivedRequest) => Boolean(item.archivedAt)));
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <Layout role="client">
      <div dir="rtl" className="space-y-5">
        <div
          className="rounded-[1.75rem] p-5"
          style={{
            background: "linear-gradient(150deg, rgba(27,29,39,0.95) 0%, rgba(15,17,24,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>الأرشيف</h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>تعرض هذه الصفحة الطلبات المؤرشفة فقط</p>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/client/request/${item.id}`}>
              <div
                className="rounded-[1.5rem] p-4 cursor-pointer"
                style={{
                  background: "linear-gradient(150deg, rgba(23,24,31,0.95) 0%, rgba(16,17,23,0.98) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="font-black" style={{ color: "var(--text)" }}>طلب #{item.id}</p>
                <p className="text-sm font-bold mt-1" style={{ color: "var(--text-sub)" }}>{item.homeLocation} ← {item.workLocation}</p>
                <p className="text-xs font-black mt-2" style={{ color: "var(--brand)" }}>{item.status}</p>
              </div>
            </Link>
          ))}
          {items.length === 0 && (
            <div className="rounded-2xl p-6 text-sm font-black" style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
              لا توجد طلبات في الأرشيف
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
