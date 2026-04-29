import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";

import ClientLogin from "@/pages/auth/ClientLogin";
import ClientRegister from "@/pages/auth/ClientRegister";
import DriverLoginPage from "@/pages/auth/DriverLoginPage";
import AdminLoginPage from "@/pages/auth/AdminLoginPage";

import ClientDashboard from "@/pages/client/ClientDashboard";
import CreateRequest from "@/pages/client/CreateRequest";
import RequestDetails from "@/pages/client/RequestDetails";
import ClientProfile from "@/pages/client/ClientProfile";
import ClientSupport from "@/pages/client/ClientSupport";

import DriverLogin from "@/pages/driver/DriverLogin";
import DriverDashboard from "@/pages/driver/DriverDashboard";
import SubmitOffer from "@/pages/driver/SubmitOffer";
import DriverProfile from "@/pages/driver/DriverProfile";
import DriverRequests from "@/pages/driver/DriverRequests";
import DriverSupport from "@/pages/driver/DriverSupport";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminOffers from "@/pages/admin/AdminOffers";
import AdminClients from "@/pages/admin/AdminClients";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminSupport from "@/pages/admin/AdminSupport";
import AdminCreateRequest from "@/pages/admin/AdminCreateRequest";
import AdminRequestDetails from "@/pages/admin/AdminRequestDetails";

// ─── PWA helpers ─────────────────────────────────────────────────────────────

const PWA_ROLE_KEY = "pwa_role";
type PwaRole = "admin" | "driver" | "client";

/** Returns the stored PWA role, if any. */
function getStoredRole(): PwaRole | null {
  try {
    return (localStorage.getItem(PWA_ROLE_KEY) as PwaRole) || null;
  } catch {
    return null;
  }
}

/** Saves a role only on the very first visit (never overwrites). */
function saveRoleOnce(role: PwaRole): void {
  try {
    if (!localStorage.getItem(PWA_ROLE_KEY)) {
      localStorage.setItem(PWA_ROLE_KEY, role);
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

// Custom event type for beforeinstallprompt (not in standard TS lib)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Silently detects which section the user is visiting and saves
 * their role to localStorage on the first visit.
 * Must be rendered inside WouterRouter.
 */
function RoleDetector() {
  const [location] = useLocation();

  useEffect(() => {
    if (location.startsWith("/admin")) {
      saveRoleOnce("admin");
    } else if (location.startsWith("/driver")) {
      saveRoleOnce("driver");
    } else if (location.startsWith("/client") || location.startsWith("/customer")) {
      saveRoleOnce("client");
    }
  }, [location]);

  return null;
}

/**
 * Shows a bottom install-prompt banner when the browser fires
 * the `beforeinstallprompt` event (Android/Chrome/Edge).
 */
function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 shadow-2xl"
      style={{ background: "linear-gradient(135deg, #312E81 0%, #4338CA 100%)" }}
      dir="rtl"
    >
      <span className="text-2xl shrink-0">📦</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-sm leading-tight">ثبّت تطبيق توصّلني</p>
        <p className="text-white/60 text-xs">وصول سريع بدون المتصفح</p>
      </div>
      <button
        onClick={install}
        className="shrink-0 bg-white text-[#312E81] font-black text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform"
      >
        ثبّت
      </button>
      <button
        onClick={() => setDeferredPrompt(null)}
        className="shrink-0 text-white/50 hover:text-white text-lg leading-none px-1"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20_000 } },
});

function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">جاري التحقق...</div>;
  if (!user || user.role !== "client") return <Redirect to="/client/login" />;
  return <>{children}</>;
}

function DriverGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">جاري التحقق...</div>;
  if (!user || user.role !== "driver") return <Redirect to="/driver/login" />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">جاري التحقق...</div>;
  if (!user || user.role !== "admin") return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <>
      {/* Silently track role on every navigation */}
      <RoleDetector />
      <Switch>
        {/* Smart home: redirect to role-specific login if the user has visited before */}
        <Route path="/">
          {() => {
            const role = getStoredRole();
            if (role === "admin") return <Redirect to="/admin/login" />;
            if (role === "driver") return <Redirect to="/driver/login" />;
            if (role === "client") return <Redirect to="/client/login" />;
            return <Home />;
          }}
        </Route>

        <Route path="/client/login" component={ClientLogin} />
        <Route path="/client/register" component={ClientRegister} />
        <Route path="/client">
          <ClientGuard><ClientDashboard /></ClientGuard>
        </Route>
        <Route path="/client/profile">
          <ClientGuard><ClientProfile /></ClientGuard>
        </Route>
        <Route path="/client/request/new">
          <ClientGuard><CreateRequest /></ClientGuard>
        </Route>
        <Route path="/client/request/:id">
          <ClientGuard><RequestDetails /></ClientGuard>
        </Route>
        <Route path="/client/support">
          <ClientGuard><ClientSupport /></ClientGuard>
        </Route>

        <Route path="/driver/login" component={DriverLoginPage} />
        <Route path="/driver" component={DriverLogin} />
        <Route path="/driver/dashboard">
          <DriverGuard><DriverDashboard /></DriverGuard>
        </Route>
        <Route path="/driver/profile">
          <DriverGuard><DriverProfile /></DriverGuard>
        </Route>
        <Route path="/driver/requests">
          <DriverGuard><DriverRequests /></DriverGuard>
        </Route>
        <Route path="/driver/support">
          <DriverGuard><DriverSupport /></DriverGuard>
        </Route>
        <Route path="/driver/request/:id">
          <DriverGuard><SubmitOffer /></DriverGuard>
        </Route>

        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          <AdminGuard><AdminDashboard /></AdminGuard>
        </Route>
        <Route path="/admin/requests">
          <AdminGuard><AdminRequests /></AdminGuard>
        </Route>
        <Route path="/admin/drivers">
          <AdminGuard><AdminDrivers /></AdminGuard>
        </Route>
        <Route path="/admin/clients">
          <AdminGuard><AdminClients /></AdminGuard>
        </Route>
        <Route path="/admin/offers">
          <AdminGuard><AdminOffers /></AdminGuard>
        </Route>
        <Route path="/admin/settings">
          <AdminGuard><AdminSettings /></AdminGuard>
        </Route>
        <Route path="/admin/support">
          <AdminGuard><AdminSupport /></AdminGuard>
        </Route>
        <Route path="/admin/request/new">
          <AdminGuard><AdminCreateRequest /></AdminGuard>
        </Route>
        <Route path="/admin/requests/new">
          <AdminGuard><AdminCreateRequest /></AdminGuard>
        </Route>
        <Route path="/admin/request/:id">
          <AdminGuard><AdminRequestDetails /></AdminGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <InstallBanner />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
