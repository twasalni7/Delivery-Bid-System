import { useState, useEffect, useCallback } from "react";

// ─── LocalStorage Keys ───────────────────────────────────────────────────────
const IOS_DISMISSED_KEY = "ios_install_dismissed";
const PUSH_ASK_KEY = "push_ask_state";
const PUSH_ENABLED_KEY = "push_enabled";
const ANALYTICS_KEY = "pwa_analytics";

/**
 * After the Nth dismissal wait this many days before re-asking.
 * Once count exceeds the array length, we never ask again.
 */
const PUSH_RETRY_SCHEDULE = [3, 7] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
interface PushAskState {
  count: number;
  lastDismissedAt: number; // Unix timestamp in ms
}

export interface PwaAnalytics {
  iosPromptShown: number;
  iosInstallClicked: number;
  pushPromptShown: number;
  pushEnabled: number;
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────
function ls<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

function lsRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export function readPwaAnalytics(): PwaAnalytics {
  return ls<PwaAnalytics>(ANALYTICS_KEY, {
    iosPromptShown: 0,
    iosInstallClicked: 0,
    pushPromptShown: 0,
    pushEnabled: 0,
  });
}

function trackEvent(key: keyof PwaAnalytics): void {
  const a = readPwaAnalytics();
  lsSet(ANALYTICS_KEY, { ...a, [key]: a[key] + 1 });
}

// ─── Device detection ────────────────────────────────────────────────────────
/**
 * Returns true on iOS (iPhone/iPad/iPod) including iPadOS 13+ which reports as
 * MacIntel but has touch support.
 */
export function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Returns true when the app is running as an installed PWA (standalone mode).
 * On iOS this is set by Safari when launched from the home screen.
 */
export function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Returns true when the browser supports the Web Push API.
 * On iOS this requires iOS 16.4+ in standalone (PWA) mode.
 */
export function detectPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// ─── Push-ask eligibility ────────────────────────────────────────────────────
function shouldOfferPush(): boolean {
  if (!detectPushSupported()) return false;

  // Already enabled via our flow
  if (lsRaw(PUSH_ENABLED_KEY) === "1") return false;

  // Sync cache if browser permission was already granted externally
  if (Notification.permission === "granted") {
    try { localStorage.setItem(PUSH_ENABLED_KEY, "1"); } catch { /* ignore */ }
    return false;
  }

  // User hard-denied in the browser settings — cannot ask again
  if (Notification.permission === "denied") return false;

  const state = ls<PushAskState | null>(PUSH_ASK_KEY, null);

  // Never been asked → eligible
  if (!state) return true;

  // Determine retry delay based on how many times the user dismissed
  const retryDays: number | undefined =
    PUSH_RETRY_SCHEDULE[state.count - 1];

  // Exceeded our retry schedule — stop asking
  if (retryDays === undefined) return false;

  const daysSinceDismissal = (Date.now() - state.lastDismissedAt) / 86_400_000;
  return daysSinceDismissal >= retryDays;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
/**
 * useInstallAndPushFlow
 *
 * Orchestrates the full install + push permission funnel:
 *
 * - iPhone (Safari, not standalone):
 *   2.5 s delay → iOS install prompt → on dismiss → push prompt (if eligible)
 *
 * - iPhone (standalone PWA, iOS 16.4+):
 *   2.5 s delay → push prompt (if eligible)
 *
 * - Android / Desktop:
 *   2.5 s delay → push prompt (if eligible)
 *
 * State is persisted in localStorage so prompts are never repeated
 * unnecessarily. Smart retry: 3 days after 1st refusal, 7 days after 2nd,
 * never after 3rd.
 */
export function useInstallAndPushFlow(canPromptForPush: boolean) {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const ios = detectIOS();
      const standalone = detectStandalone();

      // ── iOS not yet installed ───────────────────────────────────────────
      if (ios && !standalone && !lsRaw(IOS_DISMISSED_KEY)) {
        setShowIOSPrompt(true);
        trackEvent("iosPromptShown");
        return; // don't show push prompt yet — wait for install prompt dismissal
      }

      // ── All other cases (Android, Desktop, or iOS already in PWA mode) ──
      // iOS push requires standalone mode (iOS 16.4+ restriction)
      const pushEligible = ios ? standalone : true;
      if (pushEligible && canPromptForPush && shouldOfferPush()) {
        setShowPushPrompt(true);
        trackEvent("pushPromptShown");
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [canPromptForPush]);

  useEffect(() => {
    if (!canPromptForPush) {
      setShowPushPrompt(false);
    }
  }, [canPromptForPush]);

  /**
   * Called when the user closes the iOS install prompt.
   * @param clickedInstall – pass true if user tapped the install-intent button
   */
  const dismissIOSPrompt = useCallback((clickedInstall = false) => {
    setShowIOSPrompt(false);
    try { localStorage.setItem(IOS_DISMISSED_KEY, String(Date.now())); } catch { /* ignore */ }
    if (clickedInstall) trackEvent("iosInstallClicked");

    // After dismissal, offer push notification opt-in with a short delay.
    // The user may have added the app and returned to the browser tab, so
    // we show the push prompt regardless — it will only display if eligible.
    setTimeout(() => {
      if (canPromptForPush && shouldOfferPush()) {
        setShowPushPrompt(true);
        trackEvent("pushPromptShown");
      }
    }, 800);
  }, [canPromptForPush]);

  /**
   * Called when the user taps "لاحقاً" on the push permission prompt.
   * Increments the dismissal counter and records the timestamp.
   */
  const dismissPushPrompt = useCallback(() => {
    setShowPushPrompt(false);
    const state = ls<PushAskState | null>(PUSH_ASK_KEY, null);
    lsSet(PUSH_ASK_KEY, {
      count: (state?.count ?? 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  /**
   * Called after the user successfully enables push notifications.
   * Marks push as permanently enabled so we never ask again.
   */
  const markPushEnabled = useCallback(() => {
    setShowPushPrompt(false);
    try { localStorage.setItem(PUSH_ENABLED_KEY, "1"); } catch { /* ignore */ }
    trackEvent("pushEnabled");
  }, []);

  return {
    showIOSPrompt,
    showPushPrompt,
    dismissIOSPrompt,
    dismissPushPrompt,
    markPushEnabled,
  };
}
