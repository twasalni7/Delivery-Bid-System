import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { API_ORIGIN } from "@/lib/api-config";

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

createRoot(document.getElementById("root")!).render(
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
          background: "#000",
          color: "#fff",
          fontFamily: "Cairo, sans-serif",
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
            background: "#deff9a",
            color: "#000",
            fontWeight: 900,
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
);

// ─── Register Service Worker ──────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
