import { Link, useLocation } from "wouter";
import { LogOut, Menu, X, Home, FileText, User, LifeBuoy, Settings, Users, Car, BarChart2, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";

const ROLE_COLORS = {
  client: { from: "#3B82F6", to: "#1D4ED8" },
  driver: { from: "#10B981", to: "#059669" },
  admin:  { from: "#8B5CF6", to: "#6D28D9" },
};

export function Layout({ children, role }: { children: React.ReactNode; role: "client" | "driver" | "admin" }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const colors = ROLE_COLORS[role];

  const navLinks =
    role === "client"
      ? [
          { href: "/client", label: "طلباتي", icon: Home },
          { href: "/client/support", label: "الدعم", icon: LifeBuoy },
          { href: "/client/profile", label: "حسابي", icon: User },
          { href: "/client/request/new", label: "طلب جديد", primary: true },
        ]
      : role === "driver"
      ? [
          { href: "/driver/dashboard", label: "لوحة السائق", icon: Home },
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

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-gray-50 font-sans" dir="rtl">
      <header className="sticky top-0 z-20 shadow-sm" style={{ background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)` }}>
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg">
              {roleEmoji}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-white text-base leading-none">توصّلني</span>
              <span className="text-white/70 font-normal text-[10px] hidden sm:block">اشتراكات التوصيل الشهري</span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((link) =>
              link.primary ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bg-white text-blue-600 font-black px-4 py-1.5 rounded-full text-xs hover:bg-white/90 transition-colors"
                  style={{ color: colors.from }}
                >
                  {link.label}
                </Link>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    location === link.href || (link.href.length > 1 && location.startsWith(link.href))
                      ? "bg-white/20 text-white font-bold"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
            {user && (
              <button
                onClick={logout}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="تسجيل خروج"
              >
                <LogOut size={15} />
              </button>
            )}
          </nav>

          <button
            className="sm:hidden p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden border-t border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = (link as any).icon;
              return link.primary ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full bg-white font-black py-2 rounded-lg text-sm text-center"
                  style={{ color: colors.from }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-colors ${
                    location === link.href || (link.href.length > 1 && location.startsWith(link.href))
                      ? "bg-white/20 text-white font-bold"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {Icon && <Icon size={15} />}
                  {link.label}
                </Link>
              );
            })}
            {user && (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 py-2 px-3 rounded-lg text-sm text-red-200 hover:bg-white/10"
              >
                <LogOut size={15} /> تسجيل الخروج
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 container mx-auto px-4 py-5 max-w-2xl">
        {children}
      </main>
    </div>
  );
}
