import { Link, useLocation } from "wouter";
import { LogOut, Menu, X, LifeBuoy } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "./ui/button";
import { useState } from "react";

export function Layout({ children, role }: { children: React.ReactNode; role: "client" | "driver" | "admin" }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const roleLabel = role === "client" ? "عميل" : role === "driver" ? "سائق" : "مدير";

  const navLinks =
    role === "client"
      ? [
          { href: "/client", label: "طلباتي" },
          { href: "/client/support", label: "الدعم" },
          { href: "/client/profile", label: "حسابي" },
          { href: "/client/request/new", label: "طلب جديد", primary: true },
        ]
      : role === "driver"
      ? [
          { href: "/driver/dashboard", label: "لوحة السائق" },
          { href: "/driver/requests", label: "اتفاقياتي" },
          { href: "/driver/profile", label: "حسابي" },
        ]
      : [
          { href: "/admin", label: "الرئيسية" },
          { href: "/admin/requests", label: "الطلبات" },
          { href: "/admin/drivers", label: "السائقون" },
          { href: "/admin/clients", label: "العملاء" },
          { href: "/admin/offers", label: "العروض" },
          { href: "/admin/support", label: "الدعم" },
          { href: "/admin/settings", label: "الإعدادات" },
        ];

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background font-sans" dir="rtl">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity shrink-0">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md text-xl leading-none">
              🚐
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-primary text-base">توصّلني</span>
              <span className="text-muted-foreground font-normal text-[10px] hidden sm:block">اشتراكات التوصيل الشهري</span>
            </div>
            <span className="text-muted-foreground font-normal text-sm hidden sm:inline">| {roleLabel}</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-3 text-sm font-medium">
            {navLinks.map((link) =>
              link.primary ? (
                <Button key={link.href} asChild size="sm" className="font-bold">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`hover:text-primary transition-colors px-1 ${
                    location === link.href || (link.href.length > 1 && location.startsWith(link.href))
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
            {user && (
              <Button variant="ghost" size="icon" onClick={logout} title="تسجيل خروج">
                <LogOut size={16} />
              </Button>
            )}
          </nav>

          <button
            className="sm:hidden p-2 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="القائمة"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden border-t bg-card px-4 py-3 flex flex-col gap-2">
            {navLinks.map((link) =>
              link.primary ? (
                <Button key={link.href} asChild size="sm" className="font-bold w-full" onClick={() => setMenuOpen(false)}>
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`py-1.5 text-sm font-medium hover:text-primary transition-colors ${
                    location === link.href || (link.href.length > 1 && location.startsWith(link.href))
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            {user && (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-2 text-sm text-destructive font-medium py-1.5 hover:opacity-80"
              >
                <LogOut size={14} /> تسجيل الخروج
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
