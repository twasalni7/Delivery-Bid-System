import { Link, useLocation } from "wouter";
import { LogOut, Menu, X, Home, FileText, User, LifeBuoy, Settings, Users, Car, BarChart2, ClipboardList, Navigation } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { NotificationsBell } from "@/components/notifications-bell";

type NavLink = { href: string; label: string; icon: typeof Home; primary?: boolean };

export function Layout({ children, role }: { children: React.ReactNode; role: "client" | "driver" | "admin" }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
          { href: "/driver/support", label: "الدعم", icon: LifeBuoy },
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

  const isActive = (href: string) =>
    href === "/admin" || href === "/client" || href === "/driver/dashboard"
      ? location === href
      : location.startsWith(href);

  const isClientOrDriver = role === "client" || role === "driver";

  return (
    <div className="min-h-[100dvh] flex flex-col w-full" style={{ backgroundColor: "#000000", fontFamily: "'Cairo', sans-serif" }} dir="rtl">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30" style={{ backgroundColor: "#0d0d0d", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className={`mx-auto px-4 sm:px-6 h-16 flex items-center justify-between ${role === "admin" ? "max-w-6xl" : "max-w-xl"}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: "#deff9a" }}>
              <Navigation size={20} strokeWidth={3} style={{ color: "#0a0a0a" }} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-xl leading-none tracking-tighter" style={{ color: "#deff9a" }}>توصّلني</span>
              <span className="font-bold text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.4)" }}>اشتراكات التوصيل الشهري</span>
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
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                  style={active
                    ? { backgroundColor: "rgba(222,255,154,0.12)", color: "#deff9a" }
                    : { color: "rgba(255,255,255,0.5)" }}
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ color: "rgba(255,255,255,0.4)" }}
                title="تسجيل خروج"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">خروج</span>
              </button>
            )}
          </nav>

          {/* Mobile hamburger — admin only */}
          {role === "admin" && (
            <button
              className="sm:hidden p-2.5 rounded-xl transition-colors"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
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
                className="p-2.5 rounded-xl transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
                title="تسجيل خروج"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Admin mobile drawer */}
        {role === "admin" && menuOpen && (
          <div className="sm:hidden px-4 py-3 flex flex-col gap-1" style={{ backgroundColor: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl text-base font-bold transition-colors"
                  style={active
                    ? { backgroundColor: "rgba(222,255,154,0.12)", color: "#deff9a" }
                    : { color: "rgba(255,255,255,0.6)" }}
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
                className="flex items-center gap-3 py-3 px-4 rounded-xl text-base font-bold"
                style={{ color: "#f87171" }}
              >
                <LogOut size={18} /> تسجيل الخروج
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className={`flex-1 mx-auto w-full px-4 sm:px-6 py-7 ${role === "admin" ? "max-w-6xl" : "max-w-xl"} ${isClientOrDriver ? "pb-32 sm:pb-8" : ""}`}>
        {children}
      </main>

      {/* ── Bottom tab nav (client & driver mobile only) ── */}
      {isClientOrDriver && (
        <nav
          className="sm:hidden fixed bottom-0 inset-x-0 z-30 flex"
          style={{
            backgroundColor: "#0d0d0d",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "env(safe-area-inset-bottom)",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[11px] font-black transition-colors"
                style={active ? { color: "#deff9a" } : { color: "rgba(255,255,255,0.35)" }}
              >
                <div
                  className="p-2 rounded-2xl transition-all"
                  style={active ? { backgroundColor: "rgba(222,255,154,0.12)" } : {}}
                >
                  <Icon size={20} style={active ? { color: "#deff9a" } : { color: "rgba(255,255,255,0.35)" }} />
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
