import { Link, useLocation } from "wouter";
import {
  LogOut, Menu, X, Home, FileText, User, LifeBuoy, Settings,
  Users, Car, BarChart2, ClipboardList, DollarSign, Activity,
  MapPin, Bell, Search, ChevronRight, Sun, Moon, Coffee,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme, Theme } from "@/contexts/theme-context";
import { useState, useEffect } from "react";
import { NotificationsBell } from "@/components/notifications-bell";

type NavLink = { href: string; label: string; icon: typeof Home; badge?: number };

const AVATAR_COLORS = [
  "#C8102E","#2563EB","#059669","#D97706","#7C3AED","#0891B2",
  "#BE185D","#065F46","#92400E","#1E40AF",
];
function nameToColor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.COLORS_LENGTH] ?? AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light",  icon: Sun,    label: "فاتح" },
    { value: "dark",   icon: Moon,   label: "داكن" },
    { value: "creamy", icon: Coffee, label: "كريمي" },
  ];
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className="touch-compact p-1.5 rounded-lg transition-all"
          style={
            theme === value
              ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", minHeight: "auto", minWidth: "auto" }
              : { color: "var(--text-muted)", minHeight: "auto", minWidth: "auto" }
          }
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN SIDEBAR LAYOUT
   ══════════════════════════════════════════════ */
function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalNamespace) {
      await OneSignal.init({ appId: "936a2461-9f06-4231-986e-29578e9a56d7" });
    });
  }, []);

  const navLinks: NavLink[] = [
    { href: "/admin",              label: "الرئيسية",   icon: BarChart2 },
    { href: "/admin/requests",     label: "الطلبات",    icon: FileText },
    { href: "/admin/drivers",      label: "السائقون",   icon: Car },
    { href: "/admin/clients",      label: "العملاء",    icon: Users },
    { href: "/admin/offers",       label: "العروض",     icon: ClipboardList },
    { href: "/admin/pricing",      label: "التسعير",    icon: DollarSign },
    { href: "/admin/service-areas",label: "المناطق",    icon: MapPin },
    { href: "/admin/activity-logs",label: "سجل النشاط", icon: Activity },
    { href: "/admin/support",      label: "الدعم",      icon: LifeBuoy },
    { href: "/admin/settings",     label: "الإعدادات",  icon: Settings },
  ];

  const isActive = (href: string) =>
    href === "/admin" ? location === href : location.startsWith(href);

  const crumb = navLinks.find((l) => isActive(l.href))?.label ?? "";

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <MapPin size={18} style={{ color: "var(--brand-fg)" }} strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-bold text-base leading-none" style={{ color: "var(--text)" }}>توصّلني</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>اشتراكات التوصيل</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={
                active
                  ? { backgroundColor: "var(--sidebar-active-bg)", color: "var(--sidebar-active-text)", fontWeight: 700 }
                  : { color: "var(--sidebar-text)" }
              }
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--sidebar-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text-hover)"; }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; }}}
            >
              <Icon size={17} strokeWidth={active ? 2 : 1.75} style={{ color: active ? "var(--sidebar-active-text)" : "var(--sidebar-icon-color)", flexShrink: 0 }} />
              <span className="flex-1">{link.label}</span>
              {link.badge && link.badge > 0 && (
                <span className="text-[11px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + user */}
      <div className="px-3 py-3 space-y-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              {(user.name ?? "م").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>{user.name ?? "مشرف النظام"}</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user.email ?? ""}</p>
            </div>
            <button
              onClick={logout}
              className="touch-compact p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)", minHeight: "auto", minWidth: "auto" }}
              title="تسجيل الخروج"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "var(--font-arabic)", backgroundColor: "var(--bg-page)", minHeight: "100dvh", display: "flex" }}>
      {/* Desktop sidebar */}
      <aside className="admin-sidebar hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="sidebar-overlay lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="admin-sidebar sidebar-open flex flex-col lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:mr-[var(--sidebar-width)]">
        {/* Top bar */}
        <header className="admin-topbar">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-xl touch-compact"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-sub)", minHeight: "auto", minWidth: "auto" }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={19} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
            <Link href="/admin" className="font-medium" style={{ color: "var(--text-muted)" }}>
              توصّلني
            </Link>
            {crumb && (
              <>
                <ChevronRight size={13} style={{ color: "var(--text-hint)", transform: "scaleX(-1)" }} />
                <span className="font-bold truncate" style={{ color: "var(--text)" }}>{crumb}</span>
              </>
            )}
          </div>

          {/* Search */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl max-w-xs w-full"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Search size={15} style={{ color: "var(--text-hint)", flexShrink: 0 }} />
            <input
              placeholder="ابحث في كل شيء..."
              className="bg-transparent outline-none text-sm w-full"
              style={{ color: "var(--text)", fontFamily: "var(--font-arabic)", border: "none", minHeight: "auto" }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              {(user?.name ?? "م").charAt(0)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MOBILE LAYOUT (client / driver)
   ══════════════════════════════════════════════ */
function MobileLayout({ children, role }: { children: React.ReactNode; role: "client" | "driver" }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalNamespace) {
      await OneSignal.init({ appId: "936a2461-9f06-4231-986e-29578e9a56d7" });
    });
  }, []);

  const navLinks: NavLink[] =
    role === "client"
      ? [
          { href: "/client",         label: "اشتراكاتي", icon: Home },
          { href: "/client/support", label: "الدعم",      icon: LifeBuoy },
          { href: "/client/profile", label: "حسابي",      icon: User },
        ]
      : [
          { href: "/driver/dashboard", label: "الطلبات",   icon: Home },
          { href: "/driver/requests",  label: "الاتفاقات", icon: ClipboardList },
          { href: "/driver/support",   label: "الدعم",     icon: LifeBuoy },
          { href: "/driver/profile",   label: "حسابي",     icon: User },
        ];

  const isActive = (href: string) =>
    href === "/client" || href === "/driver/dashboard"
      ? location === href
      : location.startsWith(href);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-page)",
        fontFamily: "var(--font-arabic)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30"
        style={{ backgroundColor: "var(--header-bg)", borderBottom: "1px solid var(--header-border)", height: "var(--header-height)" }}
      >
        <div className="mx-auto px-4 h-full flex items-center justify-between max-w-xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--brand)" }}>
              <MapPin size={18} style={{ color: "var(--brand-fg)" }} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base leading-none" style={{ color: "var(--brand)" }}>توصّلني</span>
              <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>اشتراكات التوصيل الشهري</span>
            </div>
          </Link>

          {/* Right side actions */}
          {user && (
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <NotificationsBell />
              <button
                onClick={logout}
                className="touch-compact p-2 rounded-xl transition-colors"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)", minHeight: "auto", minWidth: "auto" }}
                title="تسجيل خروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full px-4 py-6 max-w-xl pb-32">
        {children}
      </main>

      {/* Bottom tab nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex"
        style={{
          backgroundColor: "var(--header-bg)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        }}
      >
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors"
              style={active ? { color: "var(--brand)" } : { color: "var(--text-hint)" }}
            >
              <div
                className="p-1.5 rounded-xl transition-all"
                style={active ? { backgroundColor: "var(--brand-subtle)" } : {}}
              >
                <Icon size={20} style={{ color: active ? "var(--brand)" : "var(--text-hint)" }} strokeWidth={active ? 2.2 : 1.75} />
              </div>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ══════════════════════════════════════════════
   EXPORTED LAYOUT
   ══════════════════════════════════════════════ */
export function Layout({ children, role }: { children: React.ReactNode; role: "client" | "driver" | "admin" }) {
  if (role === "admin") return <AdminLayout>{children}</AdminLayout>;
  return <MobileLayout role={role}>{children}</MobileLayout>;
}
