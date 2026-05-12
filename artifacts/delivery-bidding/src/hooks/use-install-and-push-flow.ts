import { useState, useEffect, useCallback } from "react";

// ─── LocalStorage Keys ───────────────────────────────────────────────────────
const IOS_DISMISSED_KEY = "ios_install_dismissed";
const PUSH_ASK_KEY = "push_ask_state";
const PUSH_ENABLED_KEY = "push_enabled";
const ANALYTICS_KEY = "pwa_analytics";
// Key to track if push subscription flow was completed for current user
const PUSH_LINKED_KEY = "push_linked_user";

const PUSH_RETRY_SCHEDULE = [3, 7] as const;

interface PushAskState {
  count: number;
  lastDismissedAt: number;
}

export interface PwaAnalytics {
  iosPromptShown: number;
  iosInstallClicked: number;
  pushPromptShown: number;
  pushEnabled: number;
}

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

export function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** تسجيل أن الاشتراك في Push تم لمستخدم معين */
export function markOneSignalLinked(userId: number | string): void {
  try { localStorage.setItem(PUSH_LINKED_KEY, String(userId)); } catch { /* ignore */ }
}

/** إلغاء ربط Push (عند logout) */
export function clearOneSignalLinked(): void {
  try { localStorage.removeItem(PUSH_LINKED_KEY); } catch { /* ignore */ }
}

function isOneSignalLinked(userId: number | string): boolean {
  return lsRaw(PUSH_LINKED_KEY) === String(userId);
}

function shouldOfferPush(userId?: number | string): boolean {
  if (!detectPushSupported()) return false;
  if (Notification.permission === "denied") return false;

  // إذا الإذن ممنوح والاشتراك مُكتمل — لا حاجة للعرض
  if (Notification.permission === "granted") {
    if (userId && isOneSignalLinked(userId)) {
      try { localStorage.setItem(PUSH_ENABLED_KEY, "1"); } catch { /* ignore */ }
      return false;
    }
    // الإذن ممنوح لكن OneSignal غير مربط — أعرض الزر
    return true;
  }

  if (lsRaw(PUSH_ENABLED_KEY) === "1") return false;

  const state = ls<PushAskState | null>(PUSH_ASK_KEY, null);
  if (!state) return true;

  const retryDays: number | undefined = PUSH_RETRY_SCHEDULE[state.count - 1];
  if (retryDays === undefined) return false;

  const daysSinceDismissal = (Date.now() - state.lastDismissedAt) / 86_400_000;
  return daysSinceDismissal >= retryDays;
}

export function useInstallAndPushFlow(canPromptForPush: boolean, userId?: number | string) {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    if (!canPromptForPush) {
      setShowPushPrompt(false);
      return;
    }

    const timer = setTimeout(() => {
      const ios = detectIOS();
      const standalone = detectStandalone();

      if (ios && !standalone && !lsRaw(IOS_DISMISSED_KEY)) {
        setShowIOSPrompt(true);
        trackEvent("iosPromptShown");
        return;
      }

      const pushEligible = ios ? standalone : true;
      if (pushEligible && shouldOfferPush(userId)) {
        setShowPushPrompt(true);
        trackEvent("pushPromptShown");
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [canPromptForPush, userId]);

  const dismissIOSPrompt = useCallback((clickedInstall = false) => {
    setShowIOSPrompt(false);
    try { localStorage.setItem(IOS_DISMISSED_KEY, String(Date.now())); } catch { /* ignore */ }
    if (clickedInstall) trackEvent("iosInstallClicked");

    setTimeout(() => {
      if (canPromptForPush && shouldOfferPush(userId)) {
        setShowPushPrompt(true);
        trackEvent("pushPromptShown");
      }
    }, 800);
  }, [canPromptForPush, userId]);

  const dismissPushPrompt = useCallback(() => {
    setShowPushPrompt(false);
    const state = ls<PushAskState | null>(PUSH_ASK_KEY, null);
    lsSet(PUSH_ASK_KEY, {
      count: (state?.count ?? 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

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
