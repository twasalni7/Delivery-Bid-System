import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import { useInstallAndPushFlow, markOneSignalLinked, clearOneSignalLinked } from "@/hooks/use-install-and-push-flow";
import { consumePendingNotificationInteraction } from "@/lib/notification-actions";
import { appPath, isSecurePushContext } from "@/lib/pwa-utils";
import { IOSInstallPrompt } from "@/components/ios-install-prompt";
import { PushPermissionPrompt } from "@/components/push-permission-prompt";
import { ErrorBoundary } from "@/components/error-boundary";
import { initOneSignal, loginOneSignal, logoutOneSignal } from "@/lib/push-notifications";

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

function getStoredRole(): PwaRole | null {
  try {
    return (localStorage.getItem(PWA_ROLE_KEY) as PwaRole) || null;
  } catch {
    return null;
  }
}

function saveRoleOnce(role: PwaRole): void {
  try {
    if (!localStorage.getItem(PWA_ROLE_KEY)) {
      localStorage.setItem(PWA_ROLE_KEY, role);
    }
  } catch {}
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

// ─── FlowOrchestrator ─────────────────────────────────────────────────────────
/**
 * مسؤول عن:
 * 1. تهيئة OneSignal مرة واحدة
 * 2. ربط المستخدم بـ OneSignal عند login وفك الربط عند logout
 * 3. عرض prompts التثبيت والإشعارات
 *
 * الإصلاحات (PR #134):
 * - استخدام loginOneSignal/logoutOneSignal من push-notifications.ts
 * - ServiceWorker path صحيح: /OneSignalSDKWorker.js
 * - لا تكرار في init
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
  } = useInstallAndPushFlow(canPromptForPush, user?.id as number | undefined);

  // ── OneSignal init (once on mount) ────────────────────────────────────────
  useEffect(() => {
    if (!isSecurePushContext()) {
      console.warn("[Push] OneSignal init skipped: not a secure context", {
        protocol: window.location.protocol,
        isSecureContext: window.isSecureContext,
      });
      return;
    }
    // initOneSignal handles deduplication internally
    void initOneSignal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OneSignal user linking ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // User logged out — unlink from OneSignal
      void logoutOneSignal();
      clearOneSignalLinked();
      return;
    }

    // User logged in — link device to their account
    // external_id format: role:id (e.g. "driver:42", "client:7")
    void loginOneSignal(user.id as number, user.role).then(() => {
      // ✅ سجّل أن OneSignal تم ربطه بهذا المستخدم
      markOneSignalLinked(user.id as number);
    });

    // Handle pending notification tap (if app was opened from a notification)
    const pending = consumePendingNotificationInteraction();
    if (pending?.url) {
      window.location.href = pending.url;
    }
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (user?.role === "admin") return <Redirect to="/admin" />;
  if (user?.role === "driver") return <Redirect to="/driver/dashboard" />;
  if (user?.role === "client") return <Redirect to="/client" />;
  const role = getStoredRole();
  if (role === "admin") return <Redirect to="/admin/login" />;
  if (role === "driver") return <Redirect to="/driver/login" />;
  if (role === "client") return <Redirect to="/client/login" />;
  return <Home />;
}

function Router() {
  return (
    <>
      <RoleDetector />
      <ManifestUpdater />
      <Switch>
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
        <Route path="/driver/request/:id">
          <DriverGuard><SubmitOffer /></DriverGuard>
        </Route>
        <Route path="/driver/support">
          <DriverGuard><DriverSupport /></DriverGuard>
        </Route>
        <Route path="/driver/notifications">
          <DriverGuard><NotificationsCenter /></DriverGuard>
        </Route>

        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          <AdminGuard><AdminDashboard /></AdminGuard>
        </Route>
        <Route path="/admin/requests">
          <AdminGuard><AdminRequests /></AdminGuard>
        </Route>
        <Route path="/admin/requests/new">
          <AdminGuard><AdminCreateRequest /></AdminGuard>
        </Route>
        <Route path="/admin/requests/:id">
          <AdminGuard><AdminRequestDetails /></AdminGuard>
        </Route>
        <Route path="/admin/drivers">
          <AdminGuard><AdminDrivers /></AdminGuard>
        </Route>
        <Route path="/admin/offers">
          <AdminGuard><AdminOffers /></AdminGuard>
        </Route>
        <Route path="/admin/clients">
          <AdminGuard><AdminClients /></AdminGuard>
        </Route>
        <Route path="/admin/pricing">
          <AdminGuard><AdminPricing /></AdminGuard>
        </Route>
        <Route path="/admin/settings">
          <AdminGuard><AdminSettings /></AdminGuard>
        </Route>
        <Route path="/admin/support">
          <AdminGuard><AdminSupport /></AdminGuard>
        </Route>
        <Route path="/admin/activity">
          <AdminGuard><AdminActivityLogs /></AdminGuard>
        </Route>
        <Route path="/admin/service-areas">
          <AdminGuard><AdminServiceAreas /></AdminGuard>
        </Route>
        <Route path="/admin/push-debug">
          <AdminGuard><AdminPushDebug /></AdminGuard>
        </Route>
        <Route path="/admin/operations">
          <AdminGuard><AdminOperations /></AdminGuard>
        </Route>
        <Route path="/admin/notifications">
          <AdminGuard><AdminNotificationsMonitor /></AdminGuard>
        </Route>
        <Route path="/admin/database">
          <AdminGuard><AdminDatabaseMonitor /></AdminGuard>
        </Route>
        <Route path="/admin/compose">
          <AdminGuard><AdminNotificationComposer /></AdminGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter>
              <InstallBanner />
              <FlowOrchestrator />
              <Router />
              <Toaster />
            </WouterRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
