import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import { useInstallAndPushFlow } from "@/hooks/use-install-and-push-flow";
import { consumePendingNotificationInteraction } from "@/lib/notification-actions";
import { appPath, isSecurePushContext } from "@/lib/pwa-utils";
import { IOSInstallPrompt } from "@/components/ios-install-prompt";
import { PushPermissionPrompt } from "@/components/push-permission-prompt";
import { ErrorBoundary } from "@/components/error-boundary";

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
import AdminPricing from "@/pages/admin/AdminPricing";
import AdminActivityLogs from "@/pages/admin/AdminActivityLogs";
import AdminServiceAreas from "@/pages/admin/AdminServiceAreas";
import AdminPushDebug from "@/pages/admin/AdminPushDebug";
import AdminOperations from "@/pages/admin/AdminOperations";
import AdminNotificationsMonitor from "@/pages/admin/AdminNotificationsMonitor";
import AdminDatabaseMonitor from "@/pages/admin/AdminDatabaseMonitor";
import AdminNotificationComposer from "@/pages/admin/AdminNotificationComposer";
import NotificationsCenter from "@/pages/notifications/NotificationsCenter";

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
 * Dynamically switches the <link rel="manifest"> tag based on the current
 * portal (driver / client / admin) so that when a user installs the PWA
 * from a role-specific URL the correct start_url and app name are used.
 * Must be rendered inside WouterRouter.
 */
function ManifestUpdater() {
  const [location] = useLocation();

  useEffect(() => {
    let manifestPath = appPath("manifest.json");
    if (location.startsWith("/driver")) {
      manifestPath = appPath("manifest-driver.json");
    } else if (location.startsWith("/client") || location.startsWith("/customer")) {
      manifestPath = appPath("manifest-client.json");
    } else if (location.startsWith("/admin")) {
      manifestPath = appPath("manifest-admin.json");
    }

    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      link.href = manifestPath;
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

  const role = getStoredRole();
  const appLabel =
    role === "driver" ? "تطبيق السائقين" :
    role === "client" ? "تطبيق العملاء" :
    role === "admin"  ? "تطبيق الإدارة" :
    "توصّلني";

  const install = async () => {
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 shadow-2xl"
      style={{ background: "linear-gradient(135deg, var(--brand-hover) 0%, var(--brand) 100%)" }}
      dir="rtl"
    >
      <span className="text-2xl shrink-0">📦</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight" style={{ color: "var(--brand-fg)" }}>ثبّت {appLabel}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>وصول سريع بدون المتصفح</p>
      </div>
      <button
        onClick={install}
        className="shrink-0 font-bold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform"
        style={{ backgroundColor: "var(--brand-fg)", color: "var(--brand)" }}
      >
        ثبّت
      </button>
      <button
        onClick={() => setDeferredPrompt(null)}
        className="shrink-0 text-lg leading-none px-1"
        style={{ color: "rgba(255,255,255,0.5)" }}
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}

// ─── OneSignal App ID ─────────────────────────────────────────────────────────

const ONESIGNAL_APP_ID =
  (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined) ??
  "ed8315eb-36d7-4028-ab7d-a5114eaa4061";

function getOneSignalExternalId(user: { id: number; role: "client" | "driver" | "admin" }): string {
  // OneSignal external IDs must be globally unique in our app. IDs can overlap
  // across roles (e.g. client #1 and driver #1), so we namespace by role.
  return `${user.role}:${user.id}`;
}

// ─── FlowOrchestrator ─────────────────────────────────────────────────────────
/**
 * Handles three responsibilities in one place:
 *
 * 1. OneSignal initialization (runs once on mount).
 * 2. OneSignal user linking — calls `login(userId)` after sign-in and
 *    `logout()` on sign-out so push notifications are correctly targeted.
 * 3. Smart install + push permission prompts:
 *    - iOS (Safari): iOS install guide → then push permission
 *    - Android / Desktop: push permission only
 *
 * Must be rendered inside <AuthProvider>.
 */
function FlowOrchestrator() {
  const { user } = useAuth();
  const canPromptForPush = Boolean(user?.id && user?.role);
  const {
    showIOSPrompt,
    showPushPrompt,
    dismissIOSPrompt,
    dismissPushPrompt,
    markPushEnabled,
  } = useInstallAndPushFlow(canPromptForPush);

  // ── OneSignal init (once) ─────────────────────────────────────────────────
  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      if (!isSecurePushContext()) {
        console.error("[Push] OneSignal init skipped: push requires HTTPS", {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          isSecureContext: window.isSecureContext,
        });
        return;
      }

      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          // Use our custom service worker so VAPID push handling is preserved
          // and only one SW is registered at the root scope.
          serviceWorkerPath: appPath("sw.js"),
          serviceWorkerParam: { scope: appPath() },
        });
      } catch {
        // init already called — safe to ignore
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OneSignal user linking ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // User logged out — unlink from OneSignal
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try { await OneSignal.logout(); } catch { /* non-critical */ }
      });
      return;
    }

    // User logged in — link device to their account
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.login(getOneSignalExternalId(user));
        // Also tag the role so segment-based pushes work
        await OneSignal.User.addTag("role", user.role);
        await OneSignal.User.addTag("user_id", String(user.id));
      } catch { /* non-critical */ }
    });
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    void consumePendingNotificationInteraction();
  }, [user?.id]);

  // ── Render prompts (only one at a time) ───────────────────────────────────
  if (showIOSPrompt) {
    return <IOSInstallPrompt onDismiss={dismissIOSPrompt} />;
  }

  if (showPushPrompt) {
    return (
      <PushPermissionPrompt
        role={user?.role}
        onEnabled={markPushEnabled}
        onDismiss={dismissPushPrompt}
      />
    );
  }

  return null;
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20_000 } },
});

function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-muted)", fontFamily: "var(--font-arabic)" }}>جاري التحقق...</div>;
  if (!user || user.role !== "client") return <Redirect to="/client/login" />;
  return <>{children}</>;
}

function DriverGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-muted)", fontFamily: "var(--font-arabic)" }}>جاري التحقق...</div>;
  if (!user || user.role !== "driver") return <Redirect to="/driver/login" />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-muted)", fontFamily: "var(--font-arabic)" }}>جاري التحقق...</div>;
  if (!user || user.role !== "admin") return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-muted)", fontFamily: "var(--font-arabic)" }}>جاري التحقق...</div>;
  // Authenticated users go directly to their dashboard
  if (user?.role === "admin") return <Redirect to="/admin" />;
  if (user?.role === "driver") return <Redirect to="/driver/dashboard" />;
  if (user?.role === "client") return <Redirect to="/client" />;
  // Not authenticated — use stored role to show the right login page
  const role = getStoredRole();
  if (role === "admin") return <Redirect to="/admin/login" />;
  if (role === "driver") return <Redirect to="/driver/login" />;
  if (role === "client") return <Redirect to="/client/login" />;
  return <Home />;
}

function Router() {
  return (
    <>
      {/* Silently track role on every navigation */}
      <RoleDetector />
      {/* Dynamically switch manifest per portal */}
      <ManifestUpdater />
      <Switch>
        {/* Smart home: send authenticated users to their dashboard, others to login */}
        <Route path="/" component={HomeRedirect} />

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
        <Route path="/client/notifications">
          <ClientGuard><NotificationsCenter /></ClientGuard>
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
        <Route path="/driver/notifications">
          <DriverGuard><NotificationsCenter /></DriverGuard>
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
        <Route path="/admin/pricing">
          <AdminGuard><AdminPricing /></AdminGuard>
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
        <Route path="/admin/activity-logs">
          <AdminGuard><AdminActivityLogs /></AdminGuard>
        </Route>
        <Route path="/admin/service-areas">
          <AdminGuard><AdminServiceAreas /></AdminGuard>
        </Route>
        <Route path="/admin/push-debug">
          <AdminGuard><AdminPushDebug /></AdminGuard>
        </Route>
        <Route path="/admin/notifications">
          <AdminGuard><AdminNotificationComposer /></AdminGuard>
        </Route>
        <Route path="/admin/operations">
          <AdminGuard><AdminOperations /></AdminGuard>
        </Route>
        <Route path="/admin/notifications-monitor">
          <AdminGuard><AdminNotificationsMonitor /></AdminGuard>
        </Route>
        <Route path="/admin/database-monitor">
          <AdminGuard><AdminDatabaseMonitor /></AdminGuard>
        </Route>
        <Route path="/admin/notifications-center">
          <AdminGuard><NotificationsCenter /></AdminGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <InstallBanner />
            {/* iOS install guide + push permission soft-ask */}
            <FlowOrchestrator />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

