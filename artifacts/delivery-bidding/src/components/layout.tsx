import { Link, useLocation } from "wouter";
import { LogOut, Menu, X, Home, FileText, User, LifeBuoy, Settings, Users, Car, BarChart2, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { NotificationsBell } from "@/components/notifications-bell";

const ROLE_COLORS = {
  client: { from: "#3B82F6", to: "#1D4ED8" },
  driver: { from: "#10B981", to: "#059669" },
  admin:  { from: "#8B5CF6", to: "#6D28D9" },
};

type NavLink = { href: string; label: string; icon: typeof Home; primary?: boolean };

export function Layout({ children, role }: { children: React.ReactNode; role: "client" | "driver" | "admin" }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const colors = ROLE_COLORS[role];

  const navLinks: NavLink[] =
    role === "client"
      ? [
          { href: "/client", label: "اشتراكاتي", icon: Home },
          { href: "/client/support", label: "الدعم", icon: LifeBuoy },
          { href: "/client/profile", label: "حسابي", icon: User },
        ]
      : role === "driver"
      ? [
          { href: "/driver/dashboard", label: "الطلبات", icon: Home },
          { href: "/driver/requests", label: "اتفاقياتي", icon: ClipboardList },
          { href: "/driver/profile", label: "حسابي", icon: User },
        ]
      : [
          { href: "/admin", label: "الرئيسية", icon: BarChart2 },
          { href: "/admin/requests", label: "الطلبات", icon: FileText },
          { href: "/admin/drivers", label: "السائقون", icon: Car },
          { href: "/admin/clients", label: "العملاء", icon: Users },
          { href: "/admin/offers", label: "العروض", icon: ClipboardList },
          { href: "/admin/support", label: "الدعم", icon: LifeBuoy },
          { href: "/admin/settings", label: "الإعدادات", icon: Settings },
        ];

  const roleEmoji = role === "client" ? "📦" : role === "driver" ? "🚗" : "🛡️";
  const isActive = (href: string) =>
    href === "/admin" || href === "/client" || href === "/driver/dashboard"
      ? location === href
      : location.startsWith(href);

  const isClientOrDriver = role === "client" || role === "driver";

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-gray-50" dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 shadow-md" style={{ background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)` }}>
        <div className={`mx-auto px-4 sm:px-6 h-16 flex items-center justify-between ${role === "admin" ? "max-w-6xl" : "max-w-xl"}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-sm">
              {roleEmoji}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-white text-lg leading-none">توصّلني</span>
              <span className="text-white/65 font-medium text-xs hidden sm:block">اشتراكات التوصيل الشهري</span>
            </div>
          </Link>

          {/* Desktop nav — always visible */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    active
                      ? "bg-white/25 text-white shadow-sm"
                      : "text-white/75 hover:text-white hover:bg-white/15"
                  }`}
                >
                  <Icon size={15} />
                  {link.label}
                </Link>
              );
            })}
            {user && <NotificationsBell />}
            {user && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white/70 hover:text-white hover:bg-white/15 transition-all"
                title="تسجيل خروج"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">خروج</span>
              </button>
            )}
          </nav>

          {/* Mobile hamburger — admin only; client/driver use bottom tabs */}
          {role === "admin" && (
            <button
              className="sm:hidden p-2.5 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          {/* Client/driver: bell + logout on header (mobile) */}
          {isClientOrDriver && user && (
            <div className="sm:hidden flex items-center gap-1">
              <NotificationsBell />
              <button
                onClick={logout}
                className="p-2.5 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
                title="تسجيل خروج"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Admin mobile drawer */}
        {role === "admin" && menuOpen && (
          <div className="sm:hidden border-t border-white/20 bg-black/10 backdrop-blur-sm px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 py-3 px-4 rounded-xl text-base font-bold transition-colors ${
                    active
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              );
            })}
            {user && (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 py-3 px-4 rounded-xl text-base font-bold text-red-200 hover:bg-white/10"
              >
                <LogOut size={18} /> تسجيل الخروج
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className={`flex-1 mx-auto w-full px-4 sm:px-6 py-6 ${role === "admin" ? "max-w-6xl" : "max-w-xl"} ${isClientOrDriver ? "pb-24 sm:pb-6" : ""}`}>
        {children}
      </main>

      {/* ── Bottom tab nav (client & driver mobile only) ── */}
      {isClientOrDriver && (
        <nav
          className="sm:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-gray-200 bg-white/95 backdrop-blur-md"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[11px] font-bold transition-colors ${
                  active ? "text-gray-900" : "text-gray-400"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${active ? "shadow-sm" : ""}`}
                  style={active ? { background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` } : {}}
                >
                  <Icon size={20} className={active ? "text-white" : "text-gray-400"} />
                </div>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
