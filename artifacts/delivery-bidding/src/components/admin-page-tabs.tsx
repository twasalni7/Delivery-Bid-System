import { Link, useLocation } from "wouter";

type TabItem = {
  href: string;
  label: string;
};

export function AdminPageTabs({ tabs }: { tabs: TabItem[] }) {
  const [location] = useLocation();
  return (
    <div className="mb-4">
      <div className="flex gap-2 flex-wrap rounded-2xl p-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        {tabs.map((tab) => {
          const active = location === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              style={active
                ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
