import { isSecurePushContext } from "@/lib/pwa-utils";

const PUSH_SUBSCRIBED_KEY = "push_subscribed";
const LOG_PREFIX = "[Push]";

export type PushSubscribeResult =
  | "ok"
  | "already_subscribed"
  | "unsupported"
  | "permission_denied"
  | "permission_default"
  | "insecure_context"
  | "sdk_unavailable"
  | "subscribe_error";

type OneSignalPushSubscriptionState = {
  optedIn?: boolean | (() => Promise<boolean>);
  optIn?: () => Promise<void>;
  optOut?: () => Promise<void>;
};

function emitPushStatusChanged() {
  window.dispatchEvent(new CustomEvent("push-status-changed"));
}

function cachePushEnabled(enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
    } else {
      localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    }
  } catch {
    // ignore storage failures
  }
  emitPushStatusChanged();
}

export function clearPushSubscriptionCache(): void {
  try {
    localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
  } catch {
    // ignore storage failures
  }
  emitPushStatusChanged();
  console.log(LOG_PREFIX, "subscription cache cleared");
}

async function withOneSignal<T>(fn: (oneSignal: OneSignalNamespace) => Promise<T>): Promise<T> {
  if (window.OneSignal) {
    return fn(window.OneSignal);
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("OneSignal SDK unavailable"));
    }, 5000);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      window.clearTimeout(timeoutId);
      try {
        resolve(await fn(oneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function readOneSignalPermission(oneSignal: OneSignalNamespace): Promise<NotificationPermission> {
  const permissionReader = oneSignal.Notifications.permissionNative;
  if (typeof permissionReader === "function") {
    return permissionReader();
  }
  return Notification.permission;
}

async function readOptInState(oneSignal: OneSignalNamespace): Promise<boolean> {
  const pushSubscription = oneSignal.User?.PushSubscription as OneSignalPushSubscriptionState | undefined;
  if (!pushSubscription) {
    return Notification.permission === "granted";
  }

  if (typeof pushSubscription.optedIn === "function") {
    return pushSubscription.optedIn();
  }

  if (typeof pushSubscription.optedIn === "boolean") {
    return pushSubscription.optedIn;
  }

  return Notification.permission === "granted";
}

export async function isPushEnabled(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const enabled = await withOneSignal((oneSignal) => readOptInState(oneSignal));
    cachePushEnabled(enabled);
    return enabled;
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read OneSignal opt-in state, falling back to browser permission", error);
    cachePushEnabled(true);
    return true;
  }
}

export async function subscribeToPush(_role?: string): Promise<PushSubscribeResult> {
  if (!("Notification" in window)) {
    console.warn(LOG_PREFIX, "notifications are not supported in this browser");
    return "unsupported";
  }

  if (!isSecurePushContext()) {
    console.error(LOG_PREFIX, "push subscription requires HTTPS");
    return "insecure_context";
  }

  try {
    return await withOneSignal(async (oneSignal) => {
      let permission = await readOneSignalPermission(oneSignal);
      let enabled = permission === "granted" ? await readOptInState(oneSignal) : false;

      if (enabled) {
        cachePushEnabled(true);
        return "already_subscribed";
      }

      if (permission === "default") {
        if (oneSignal.Slidedown) {
          try {
            await oneSignal.Slidedown.promptPush();
          } catch {
            // fall through to native permission handling below
          }
        }

        permission = await readOneSignalPermission(oneSignal);
        if (permission === "default") {
          await oneSignal.Notifications.requestPermission();
          permission = await readOneSignalPermission(oneSignal);
        }
      }

      if (permission === "denied") {
        cachePushEnabled(false);
        return "permission_denied";
      }

      if (permission !== "granted") {
        cachePushEnabled(false);
        return "permission_default";
      }

      const pushSubscription = oneSignal.User?.PushSubscription as OneSignalPushSubscriptionState | undefined;
      if (pushSubscription?.optIn) {
        await pushSubscription.optIn();
      }

      enabled = await readOptInState(oneSignal);
      cachePushEnabled(enabled);
      return enabled ? "ok" : "subscribe_error";
    });
  } catch (error) {
    console.error(LOG_PREFIX, "OneSignal subscription failed", error);
    return window.OneSignal || window.OneSignalDeferred ? "subscribe_error" : "sdk_unavailable";
  }
}
