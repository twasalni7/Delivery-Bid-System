import { Component, type ErrorInfo, type ReactNode } from "react";
import { API_ORIGIN } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to a generic error screen. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary catches unhandled React rendering errors and:
 *  1. Reports them to POST /api/admin/live-errors for the admin to see.
 *  2. Renders a friendly recovery screen instead of a blank/broken page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to the admin live-errors endpoint (best-effort, fire-and-forget)
    void fetch(`${API_ORIGIN}/api/admin/live-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        errorType: error.name ?? "UnknownError",
        message: error.message ?? String(error),
        stack: (error.stack ?? "") + "\n\nComponent Stack:\n" + (info.componentStack ?? ""),
        page: typeof window !== "undefined" ? window.location.pathname : null,
        severity: "error",
      }),
    }).catch(() => {
      // Never let reporting failures crash anything
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div
          dir="rtl"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "var(--bg, #0f0f0f)",
            color: "var(--text, #f5f5f5)",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
              حدث خطأ غير متوقع
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted, #888)", marginBottom: 24 }}>
              تعذّر عرض هذه الصفحة. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.reset}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: "var(--brand, #22c55e)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                إعادة المحاولة
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "1px solid var(--border, #333)",
                  backgroundColor: "transparent",
                  color: "var(--text-muted, #888)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                العودة للرئيسية
              </button>
            </div>
            {import.meta.env.DEV && (
              <details
                style={{
                  marginTop: 24,
                  textAlign: "left",
                  direction: "ltr",
                  backgroundColor: "var(--surface, #1a1a1a)",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  color: "#f87171",
                  border: "1px solid var(--border, #333)",
                  overflowX: "auto",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>Error Details (dev only)</summary>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {error.stack ?? error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
