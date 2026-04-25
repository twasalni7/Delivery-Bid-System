import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import React from "react";

import Home from "@/pages/Home";

import ClientLogin from "@/pages/auth/ClientLogin";
import ClientRegister from "@/pages/auth/ClientRegister";
import DriverLoginPage from "@/pages/auth/DriverLoginPage";
import AdminLoginPage from "@/pages/auth/AdminLoginPage";

import ClientDashboard from "@/pages/client/ClientDashboard";
import CreateRequest from "@/pages/client/CreateRequest";
import RequestDetails from "@/pages/client/RequestDetails";
import ClientProfile from "@/pages/client/ClientProfile";

import DriverLogin from "@/pages/driver/DriverLogin";
import DriverDashboard from "@/pages/driver/DriverDashboard";
import SubmitOffer from "@/pages/driver/SubmitOffer";
import DriverProfile from "@/pages/driver/DriverProfile";
import DriverRequests from "@/pages/driver/DriverRequests";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminOffers from "@/pages/admin/AdminOffers";
import AdminClients from "@/pages/admin/AdminClients";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminSupport from "@/pages/admin/AdminSupport";
import ClientSupport from "@/pages/client/ClientSupport";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20_000 } },
});

// ─── Error Boundary ──────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; message: string }

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : "خطأ غير متوقع في التطبيق";
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "sans-serif",
            padding: "2rem",
            background: "#fff9f9",
            color: "#c0392b",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            ⚠️ تعذّر تشغيل التطبيق
          </h1>
          <p style={{ maxWidth: 480, lineHeight: 1.7 }}>{this.state.message}</p>
          <p style={{ marginTop: "1rem", color: "#555", fontSize: "0.9rem" }}>
            تحقق من ملف <code>.env</code> وتأكد من تعريف{" "}
            <code>VITE_SUPABASE_URL</code> و{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> قبل رفع التطبيق.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <Switch>
      <Route path="/" component={Home} />

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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={base}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
