/**
 * push-notifications.ts — OneSignal Integration
 * يستخدم OneSignal SDK v16 للإشعارات
 *
 * الإصلاحات (PR #135):
 * 1. external_id format: role:id (مطابق للبكند)
 * 2. إضافة role tag عند loginOneSignal لدعم notifyAllDrivers/Admins
 * 3. initOneSignal يستخدم OneSignalSDKWorker.js
 */

const LOG_PREFIX = "[Push]";

declare global {
  interface Window {
    OneSignal?: OneSignalType;
    OneSignalDeferred?: ((os: OneSignalType) => void)[];
  }
}

interface OneSignalType {
  init: (config: OneSignalConfig) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
    addEventListener: (event: string, listener: (permission: boolean) => void) => void;
  };
  User: {
    PushSubscription: {
      id: string | null;
      token: string | null;
      optedIn: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
    };
    addTag: (key: string, value: string) => void;
    addTags: (tags: Record<string, string>) => void;
  };
  Slidedown?: {
    promptPush: () => Promise<void>;
  };
}

interface OneSignalConfig {
  appId: string;
  serviceWorkerParam?: { scope: string };
  serviceWorkerPath?: string;
  notifyButton?: { enable: boolean };
  allowLocalhostAsSecureOrigin?: boolean;
}

// App ID with hardcoded fallback
const ONESIGNAL_APP_ID =
  (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined) ??
  "ed8315eb-36d7-4028-ab7d-a5114eaa4061";

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * تهيئة OneSignal — يُستدعى مرة واحدة عند تحميل التطبيق
 */
export async function initOneSignal(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  if (!ONESIGNAL_APP_ID) {
    console.warn(LOG_PREFIX, "ONESIGNAL_APP_ID غير موجود — الإشعارات معطلة");
    return;
  }

  initPromise = new Promise<void>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: OneSignalType) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        initialized = true;
        console.log(LOG_PREFIX, "OneSignal initialized ✓", { appId: ONESIGNAL_APP_ID });
      } catch (err) {
        console.warn(LOG_PREFIX, "OneSignal init warning:", err);
        initialized = true;
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
    if (token) {
      console.log(LOG_PREFIX, `subscribeToPush ✓ externalId=${externalId} token=${token.slice(0, 20)}...`);
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
