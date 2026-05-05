import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { API_ORIGIN } from "@/lib/api-config";
import { appPath, isSecurePushContext } from "@/lib/pwa-utils";
import { ThemeProvider } from "@/contexts/theme-context";

// ─── Sentry Error Monitoring ─────────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      // Benign browser extension / SW errors
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /^Loading chunk \d+ failed/,
    ],
  });
}

setBaseUrl(API_ORIGIN || null);
setAuthTokenGetter(() => {
  try { return localStorage.getItem("auth_token"); } catch { return null; }
});

const shouldRedirectToHttps =
  window.location.protocol === "http:" &&
  !isSecurePushContext();

if (shouldRedirectToHttps) {
  const httpsUrl = new URL(window.location.href);
  httpsUrl.protocol = "https:";
  console.warn("[Push] Redirecting to HTTPS before app boot", {
    from: window.location.href,
    to: httpsUrl.toString(),
  });
  window.location.replace(httpsUrl.toString());
} else {
  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <Sentry.ErrorBoundary
      fallback={
        <div
          dir="rtl"
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            background: "var(--bg)",
            color: "var(--text)",
            fontFamily: "var(--font-arabic)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 900, marginBottom: "0.5rem" }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem", textAlign: "center" }}>
            يرجى تحديث الصفحة. إذا استمرت المشكلة، أغلق التطبيق وأعد فتحه.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--brand)",
              color: "var(--brand-fg)",
              fontWeight: 700,
              padding: "0.75rem 2rem",
              borderRadius: "0.75rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            تحديث الصفحة
          </button>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
    </ThemeProvider>
  );
}

// ─── Register Service Worker ──────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (!isSecurePushContext()) {
      console.error("[Push] Service worker registration skipped: push requires HTTPS", {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecureContext: window.isSecureContext,
      });
      return;
    }

    navigator.serviceWorker
      .register(appPath("sw.js"), { scope: appPath() })
      .then((registration) => {
        console.log("[Push] Service worker registered on app boot ✓", {
          scope: registration.scope,
          scriptURL: appPath("sw.js"),
        });
      })
      .catch((err) => console.error("[Push] Service worker registration failed:", err));
  });
}
