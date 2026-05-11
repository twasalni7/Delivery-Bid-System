/**
 * push-notifications.ts — OneSignal Integration
 * يستخدم OneSignal SDK v16 للإشعارات
 *
 * الإصلاحات (PR #135):
 * 1. external_id format: role:id (مطابق للبكند)
 * 2. إضافة role tag عند loginOneSignal لدعم notifyAllDrivers/Admins
 * 3. initOneSignal يستخدم OneSignalSDKWorker.js
 */

import { API_ORIGIN } from "@/lib/api-config";
import { appPath } from "@/lib/pwa-utils";

const LOG_PREFIX = "[Push]";
const INIT_MAX_ATTEMPTS = 3;
const INIT_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

let resolvedAppId: string | null | undefined;

let initialized = false;
let initPromise: Promise<void> | null = null;
let initAttempts = 0;
let firstInitFailureAt: number | null = null;

function parseOneSignalAppId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function resolveOneSignalAppId(): Promise<string | null> {
  if (resolvedAppId !== undefined) {
    return resolvedAppId;
  }

  const envAppId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
  if (envAppId) {
    resolvedAppId = envAppId;
    return resolvedAppId;
  }

  try {
    const res = await fetch(`${API_ORIGIN}/api/push/public-config`);
    if (!res.ok) {
      resolvedAppId = null;
      return null;
    }
    const body = (await res.json()) as { oneSignalAppId?: unknown };
    resolvedAppId = parseOneSignalAppId(body.oneSignalAppId);
    return resolvedAppId;
  } catch {
    resolvedAppId = null;
    return null;
  }
}

/**
 * تهيئة OneSignal — يُستدعى مرة واحدة عند تحميل التطبيق
 */
export async function initOneSignal(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  if (
    firstInitFailureAt &&
    Date.now() - firstInitFailureAt >= INIT_RETRY_COOLDOWN_MS
  ) {
    initAttempts = 0;
    firstInitFailureAt = null;
  }
  if (initAttempts >= INIT_MAX_ATTEMPTS) {
    throw new Error("OneSignal init reached max retry attempts");
  }

  const oneSignalAppId = await resolveOneSignalAppId();

  if (!oneSignalAppId) {
    console.warn(LOG_PREFIX, "ONESIGNAL_APP_ID غير موجود — الإشعارات معطلة");
    return;
  }

  initAttempts += 1;
  initPromise = new Promise<void>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: OneSignalNamespace) => {
      try {
        await OneSignal.init({
          appId: oneSignalAppId,
          serviceWorkerPath: appPath("sw.js"),
          serviceWorkerParam: { scope: appPath() },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        initialized = true;
        initAttempts = 0;
        firstInitFailureAt = null;
        console.log(LOG_PREFIX, "OneSignal initialized ✓", { appId: oneSignalAppId });
      } catch (err) {
        console.warn(LOG_PREFIX, "OneSignal init warning:", err);
        initialized = false;
        if (!firstInitFailureAt) {
          firstInitFailureAt = Date.now();
        }
        initPromise = null;
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      resolve();
    });
  });

  return initPromise;
}

/**
 * ربط المستخدم بـ OneSignal باستخدام external_id
 * الصيغة: role:id (مثال: driver:42, client:7, admin:1)
 * يُضيف role tag لدعم إشعارات المجموعة (notifyAllDrivers/Admins)
 */
export async function loginOneSignal(userId: number, role: string): Promise<void> {
  // external_id: role:id — يجب أن يطابق buildExternalId() في البكند
  const externalId = `${role}:${userId}`;
  try {
    await initOneSignal();
    const os = window.OneSignal;
    if (!os) {
      console.warn(LOG_PREFIX, "OneSignal SDK not ready");
      return;
    }

    // ربط المستخدم بالجهاز
    await os.login(externalId);
    console.log(LOG_PREFIX, `OneSignal login ✓ externalId=${externalId}`);

    // إضافة role tag لدعم notifyAllDrivers / notifyAllAdmins
    try {
      os.User.addTags({ role, userId: String(userId) });
      console.log(LOG_PREFIX, `Tags added ✓ role=${role}`);
    } catch {
      // addTags اختيارية — لا توقف التسجيل
    }

    // طلب الإذن إذا لم يكن ممنوحاً
    if (!os.Notifications.permission) {
      try {
        await os.Notifications.requestPermission();
      } catch {
        // المستخدم رفض — ليس خطأً
      }
    }

    // Opt-in للـ push subscription
    if (os.Notifications.permission && !os.User.PushSubscription.optedIn) {
      try {
        await os.User.PushSubscription.optIn();
      } catch {
        // قد تفشل إذا لم تكن هناك subscription بعد
      }
    }

    // Diagnostics: log subscription identifiers when available
    try {
      const rawOptedIn = os.User.PushSubscription.optedIn;
      const optedIn =
        typeof rawOptedIn === "function" ? await rawOptedIn() : Boolean(rawOptedIn);
      const token = os.User.PushSubscription.token ?? null;
      const subscriptionId = os.User.PushSubscription.id ?? null;
      console.log(LOG_PREFIX, "Push subscription status", {
        externalId,
        permission: os.Notifications.permission,
        optedIn,
        subscriptionId,
        tokenPrefix: token ? `${token.slice(0, 16)}...` : null,
      });
    } catch {
      // diagnostics only
    }
  } catch (err) {
    console.warn(LOG_PREFIX, "OneSignal loginOneSignal error:", err);
  }
}

/**
 * تسجيل خروج المستخدم من OneSignal
 */
export async function logoutOneSignal(): Promise<void> {
  try {
    const os = window.OneSignal;
    if (!os) return;
    await os.logout();
    console.log(LOG_PREFIX, "OneSignal logout ✓");
  } catch (err) {
    console.warn(LOG_PREFIX, "OneSignal logout error:", err);
  }
}

/**
 * طلب إذن الإشعارات يدوياً (زر "فعّل الإشعارات")
 */
export async function requestPushPermission(): Promise<"granted" | "denied" | "default"> {
  try {
    await initOneSignal();
    const os = window.OneSignal;
    if (!os) return "default";

    if (os.Notifications.permission) return "granted";

    await os.Notifications.requestPermission();
    return os.Notifications.permission ? "granted" : "denied";
  } catch (err) {
    console.warn(LOG_PREFIX, "requestPushPermission error:", err);
    return "default";
  }
}

/**
 * subscribeToPush — يُستدعى من push-permission-prompt.tsx
 */
export async function subscribeToPush(
  role?: string
): Promise<"ok" | "already_subscribed" | "server_error" | "unsupported" | "denied"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return "server_error";
    const user = JSON.parse(raw);
    const userId = user?.id;
    const userRole = role ?? user?.role;
    if (!userId || !userRole) return "server_error";

    await initOneSignal();
    const os = window.OneSignal;
    if (!os) return "server_error";

    // ربط المستخدم بـ external_id الصحيح (role:id)
    const externalId = `${userRole}:${userId}`;
    await os.login(externalId);

    // إضافة role tag
    try {
      os.User.addTags({ role: userRole, userId: String(userId) });
    } catch {
      // اختيارية
    }

    // طلب الإذن
    if (!os.Notifications.permission) {
      await os.Notifications.requestPermission();
    }

    if (Notification.permission !== "granted") return "denied";

    // Opt-in
    if (!os.User.PushSubscription.optedIn) {
      await os.User.PushSubscription.optIn();
    }

    const token = os.User.PushSubscription.token;
    const subscriptionId = os.User.PushSubscription.id ?? null;
    if (token) {
      console.log(LOG_PREFIX, `subscribeToPush ✓ externalId=${externalId}`, {
        subscriptionId,
        tokenPrefix: `${token.slice(0, 20)}...`,
      });
    }

    return "ok";
  } catch (err) {
    console.error(LOG_PREFIX, "subscribeToPush error:", err);
    return "server_error";
  }
}

/** للتوافق مع الكود القديم */
export function clearPushSubscriptionCache(): void {
  localStorage.removeItem("push_subscribed");
}
