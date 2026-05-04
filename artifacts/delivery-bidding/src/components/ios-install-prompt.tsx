import type { FC } from "react";

interface IOSInstallPromptProps {
  /** Called when the user closes the prompt. Pass true if they tapped the install intent button. */
  onDismiss: (clickedInstall?: boolean) => void;
}

/**
 * IOSInstallPrompt
 *
 * Bottom-sheet overlay that guides iOS Safari users through the
 * "Add to Home Screen" flow. Only rendered on iOS devices when the
 * app is not running in standalone (PWA) mode.
 *
 * Design follows the existing CSS token system (var(--*) vars).
 */
export const IOSInstallPrompt: FC<IOSInstallPromptProps> = ({ onDismiss }) => {
  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="دليل تثبيت التطبيق"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-12 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--border)" }}
          />
        </div>

        <div className="px-5 pt-3 pb-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex-1">
              <h2 className="text-xl font-black leading-tight" style={{ color: "var(--text)" }}>
                ثبّت التطبيق 📱
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                أضفه للشاشة الرئيسية لتصفح أسرع وإشعارات فورية
              </p>
            </div>
            <button
              onClick={() => onDismiss()}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>

          {/* Step-by-step instructions */}
          <div className="space-y-4 mb-5">
            <InstallStep n={1}>
              اضغط على زر{" "}
              <span
                className="inline-flex items-center gap-1 font-bold"
                style={{ color: "var(--brand)" }}
              >
                المشاركة <ShareIcon />
              </span>{" "}
              في شريط أسفل Safari
            </InstallStep>

            <InstallStep n={2}>مرّر للأسفل في قائمة المشاركة</InstallStep>

            <InstallStep n={3}>
              اضغط على{" "}
              <span className="font-bold" style={{ color: "var(--brand)" }}>
                «إضافة إلى الشاشة الرئيسية»
              </span>
            </InstallStep>

            <InstallStep n={4}>
              أخيراً اضغط{" "}
              <span className="font-bold" style={{ color: "var(--brand)" }}>
                «إضافة»
              </span>{" "}
              في الركن العلوي
            </InstallStep>
          </div>

          {/* Visual hint pointing to share button */}
          <div
            className="rounded-2xl px-4 py-3 mb-5 text-center"
            style={{
              backgroundColor: "var(--brand-subtle)",
              border: "1px solid var(--brand-border)",
            }}
          >
            <p className="text-2xl mb-0.5">📤</p>
            <p className="text-sm font-bold" style={{ color: "var(--brand)" }}>
              ابحث عن زر المشاركة في الأسفل
            </p>
          </div>

          {/* Primary CTA — tells OS they understood and intend to install */}
          <button
            className="w-full py-3.5 rounded-2xl font-bold text-sm mb-2.5"
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-fg)",
              border: "none",
              boxShadow: "0 2px 8px rgba(200,16,46,0.25)",
            }}
            onClick={() => onDismiss(true)}
          >
            حسناً، سأثبّت التطبيق
          </button>

          <button
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
            onClick={() => onDismiss()}
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Internal helpers ────────────────────────────────────────────────────────

function InstallStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black"
        style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
      >
        {n}
      </span>
      <p className="text-sm leading-relaxed pt-0.5" style={{ color: "var(--text)" }}>
        {children}
      </p>
    </div>
  );
}

/** iOS Safari share button icon (SVG replica of the native Share sheet icon) */
function ShareIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
