import { Link, useLocation } from "wouter";
import { Package, LogOut } from "lucide-react";
import { useDriverSession } from "../hooks/use-driver-session";
import { Button } from "./ui/button";

export function Layout({ children, role }: { children: React.ReactNode, role: "client" | "driver" | "admin" }) {
  const [location, setLocation] = useLocation();
  const { driverId, setDriverId } = useDriverSession();

  const handleLogout = () => {
    if (role === "driver") {
      setDriverId(null);
      setLocation("/driver");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background font-sans">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="bg-primary text-primary-foreground p-1 rounded-sm">
              <Package size={20} />
            </div>
            SwiftBid<span className="text-muted-foreground font-normal ml-1">| {role.toUpperCase()}</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm font-medium">
            {role === "client" && (
              <>
                <Link href="/client" className={`hover:text-primary transition-colors ${location === "/client" ? "text-primary" : "text-muted-foreground"}`}>Requests</Link>
                <Button asChild size="sm" className="font-bold">
                  <Link href="/client/request/new">New Request</Link>
                </Button>
              </>
            )}
            
            {role === "driver" && driverId && (
              <>
                <Link href="/driver/dashboard" className={`hover:text-primary transition-colors ${location === "/driver/dashboard" ? "text-primary" : "text-muted-foreground"}`}>Dashboard</Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut size={16} />
                </Button>
              </>
            )}

            {role === "admin" && (
              <>
                <Link href="/admin" className={`hover:text-primary transition-colors ${location === "/admin" ? "text-primary" : "text-muted-foreground"}`}>Overview</Link>
                <Link href="/admin/requests" className={`hover:text-primary transition-colors ${location.startsWith("/admin/requests") ? "text-primary" : "text-muted-foreground"}`}>Requests</Link>
                <Link href="/admin/drivers" className={`hover:text-primary transition-colors ${location.startsWith("/admin/drivers") ? "text-primary" : "text-muted-foreground"}`}>Drivers</Link>
                <Link href="/admin/offers" className={`hover:text-primary transition-colors ${location.startsWith("/admin/offers") ? "text-primary" : "text-muted-foreground"}`}>Offers</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
