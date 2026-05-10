import { Link, useLocation } from "wouter";
import {
  LogOut, Menu, Home, FileText, User, LifeBuoy, Settings,
  Users, Car, BarChart2, ClipboardList, DollarSign, Activity,
  MapPin, Search, ChevronRight, Sun, Moon, Coffee, Bell, Database, MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme, Theme } from "@/contexts/theme-context";
import { useState } from "react";
import { NotificationsBell } from "@/components/notifications-bell";

type NavLink = { href: string; label: string; icon: typeof Home; badge?: number };
type NavGroup = { label: string; links: NavLink[] };

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
  const roleLabel =
    user?.role === "admin" ? "إدارة النظام" : user?.role === "driver" ? "سائق" : "عميل";

  const navGroups: NavGroup[] = [
    {
      label: "الرئيسية",
      links: [
        { href: "/admin", label: "لوحة التحكم", icon: BarChart2 },
      ],
    },
    {
      label: "إدارة البيانات",
      links: [
        { href: "/admin/requests",      label: "الطلبات",    icon: FileText },
        { href: "/admin/archive",       label: "الأرشيف",    icon: ClipboardList },
        { href: "/admin/drivers",       label: "السائقون",   icon: Car },
        { href: "/admin/clients",       label: "العملاء",    icon: Users },
        { href: "/admin/offers",        label: "العروض",     icon: ClipboardList },
        { href: "/admin/service-areas", label: "المناطق",    icon: MapPin },
        { href: "/admin/pricing",       label: "التسعير",    icon: DollarSign },
      ],
    },
    {
      label: "المراقبة",
      links: [
        { href: "/admin/operations",              label: "مركز التحكم",     icon: Activity },
        { href: "/admin/activity",                label: "سجل النشاط",      icon: Activity },
        { href: "/admin/notifications",           label: "مركز الإشعارات",  icon: Bell },
        { href: "/admin/database",                label: "قاعدة البيانات",   icon: Database },
      ],
    },
    {
      label: "الدعم والإعدادات",
      links: [
        { href: "/admin/support",  label: "الدعم",      icon: LifeBuoy },
        { href: "/admin/settings", label: "الإعدادات",  icon: Settings },
      ],
    },
  ];

  // Flat list for breadcrumb lookup
  const allNavLinks = navGroups.flatMap((g) => g.links);

  const isActive = (href: string) =>
    href === "/admin" ? location === href : location.startsWith(href);

  const crumb = allNavLinks.find((l) => isActive(l.href))?.label ?? "";

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
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>لوحة الإدارة</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-hint)" }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.links.map((link) => {
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
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--sidebar-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text-hover)"; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; } }}
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
            </div>
          </div>
        ))}
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
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{roleLabel}</p>
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
  const [driverSideMenuOpen, setDriverSideMenuOpen] = useState(false);
  const displayName = user?.name?.trim() || "مستخدم";
  const displayInitial = displayName.charAt(0);

  const navLinks: NavLink[] =
    role === "client"
      ? [
          { href: "/client/profile", label: "الحساب",   icon: User },
          { href: "/client",         label: "الرئيسية", icon: Home },
          { href: "/client/archive", label: "الأرشيف",  icon: FileText },
          { href: "/client/support", label: "المزيد",   icon: LifeBuoy },
        ]
      : [
          { href: "/driver/profile",   label: "الحساب",    icon: User },
          { href: "/driver/dashboard", label: "طلباتي",    icon: Home },
          { href: "/driver/requests",  label: "اشتراكاتي", icon: ClipboardList },
          { href: "/driver/archive",   label: "الأرشيف",   icon: FileText },
          { href: "/driver/support",   label: "المزيد",    icon: MoreHorizontal },
        ];

  const driverSideLinks: NavLink[] = [
    { href: "/driver/dashboard", label: "الرئيسية", icon: Home },
    { href: "/driver/requests", label: "طلباتي", icon: ClipboardList },
    { href: "/driver/profile", label: "الملف الشخصي", icon: User },
    { href: "/driver/archive", label: "الأرشيف", icon: FileText },
    { href: "/driver/support", label: "المساعدة والدعم", icon: LifeBuoy },
    { href: "/driver/notifications", label: "الإشعارات", icon: Bell },
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
        background: "var(--bg-page)",
        fontFamily: "var(--font-arabic)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30"
        style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)", backdropFilter: "blur(8px)" }}
      >
        <div className="mx-auto px-4 py-3 flex items-center justify-between max-w-xl">
          <div className="flex items-center gap-2.5">
            {role === "driver" && (
              <button
                onClick={() => setDriverSideMenuOpen(true)}
                className="touch-compact p-2 rounded-xl transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)", minHeight: "auto", minWidth: "auto" }}
                title="القائمة"
              >
                <Menu size={16} />
              </button>
            )}
            <Link href={role === "client" ? "/client" : "/driver/dashboard"} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black shadow-lg" style={{ background: "linear-gradient(145deg, #f5f6fa 0%, #d7d9e2 100%)", color: "#0f172a" }}>
              {displayInitial}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>مرحباً {displayName}</p>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {role === "client" ? "أهلاً بك في بوابة العميل" : "لوحة السائق"}
              </p>
            </div>
            </Link>
          </div>

          {/* Right side actions */}
          {user && (
            <div className="flex items-center gap-1.5">
              <div>
                <ThemeToggle />
              </div>
              <div className="rounded-xl p-0.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <NotificationsBell />
              </div>
              {role === "client" && (
                <button
                  onClick={logout}
                  className="touch-compact p-2 rounded-xl transition-colors"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)", minHeight: "auto", minWidth: "auto" }}
                  title="تسجيل خروج"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {role === "driver" && driverSideMenuOpen && (
        <>
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setDriverSideMenuOpen(false)}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-[82%] max-w-[320px] p-4"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-xl)" }}
          >
            <div className="h-full rounded-3xl px-4 py-5 flex flex-col" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black" style={{ background: "linear-gradient(145deg, #f5f6fa 0%, #d7d9e2 100%)", color: "#0f172a" }}>
                    {displayInitial}
                  </div>
                  <div>
                    <p className="font-black text-base" style={{ color: "var(--text)" }}>{displayName}</p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>سائق نشط</p>
                  </div>
                </div>
                <button
                  onClick={() => setDriverSideMenuOpen(false)}
                  className="touch-compact p-2 rounded-xl transition-colors"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)", minHeight: "auto", minWidth: "auto" }}
                  title="إغلاق"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex-1 py-4 space-y-1.5">
                {driverSideLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setDriverSideMenuOpen(false)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-2xl text-sm font-black"
                      style={active
                        ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                        : { color: "var(--text-sub)" }}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon size={17} />
                        {link.label}
                      </span>
                      <ChevronRight size={14} style={{ transform: "scaleX(-1)" }} />
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={() => { setDriverSideMenuOpen(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black"
                style={{ backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)", border: "1px solid var(--status-cancelled-border)" }}
              >
                <LogOut size={15} />
                تسجيل الخروج
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Content */}
      <main className="flex-1 mx-auto w-full px-4 py-5 max-w-xl pb-32">
        {children}
      </main>

      {/* Bottom tab nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 px-3 pb-2"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
        }}
      >
        <div
          className="mx-auto max-w-xl w-full rounded-[1.4rem] border px-1 py-1.5 flex"
          style={{ background: "var(--header-bg)", borderColor: "var(--header-border)", boxShadow: "var(--shadow-lg)" }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors rounded-xl"
                style={active ? { color: "var(--brand-fg)", background: "linear-gradient(180deg, #ea1e3f 0%, #cf1232 100%)" } : { color: "var(--text-hint)" }}
              >
                <Icon size={19} style={{ color: active ? "var(--brand-fg)" : "var(--text-hint)" }} strokeWidth={active ? 2.2 : 1.8} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
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
