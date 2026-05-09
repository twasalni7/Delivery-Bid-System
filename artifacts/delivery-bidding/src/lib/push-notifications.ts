/**
 * push-notifications.ts — OneSignal Integration
 * يستخدم OneSignal SDK v16 للإشعارات
 *
 * الإصلاحات (PR #134):
 * 1. subscribeToPush يرجع "ok" | "already_subscribed" | "server_error" | "unsupported" | "denied"
 * 2. loginOneSignal يسجّل المستخدم بـ external_id صح (role:id)
 * 3. initOneSignal يستخدم OneSignalSDKWorker.js بدل sw.js
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
          // OneSignal يحتاج worker على / (root) — لا نستخدم sw.js هنا
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        initialized = true;
        console.log(LOG_PREFIX, "OneSignal initialized ✓", { appId: ONESIGNAL_APP_ID });
      } catch (err) {
        // init قد تُستدعى مرتين — آمن نتجاهل
        console.warn(LOG_PREFIX, "OneSignal init warning:", err);
        initialized = true; // نعتبرها مهيّأة على أي حال
      }
      resolve();
    });
  });

  return initPromise;
}

/**
 * ربط المستخدم بـ OneSignal باستخدام external_id
 * يتم استدعاؤه عند تسجيل الدخول
 * 
 * @param userId - رقم المستخدم في قاعدة البيانات
 * @param role - "driver" | "client" | "admin"
 */
export async function loginOneSignal(userId: number, role: string): Promise<void> {
  // external_id: role:id — مثال: driver:42
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
 *
 * يرجع:
 * - "ok"                → تم التسجيل بنجاح
 * - "already_subscribed" → المستخدم مسجّل مسبقاً
 * - "server_error"      → خطأ في الخادم
 * - "unsupported"       → المتصفح لا يدعم الإشعارات
 * - "denied"            → المستخدم رفض الإذن
 */
export async function subscribeToPush(
  role?: string
): Promise<"ok" | "already_subscribed" | "server_error" | "unsupported" | "denied"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  try {
    // اقرأ المستخدم الحالي
    const raw = localStorage.getItem("auth_user");
    if (!raw) return "server_error";
    const user = JSON.parse(raw);
    const userId = user?.id;
    const userRole = role ?? user?.role;
    if (!userId || !userRole) return "server_error";

    await initOneSignal();
    const os = window.OneSignal;
    if (!os) return "server_error";

    // ربط المستخدم
    const externalId = `${userRole}:${userId}`;
    await os.login(externalId);

    // طلب الإذن
    if (!os.Notifications.permission) {
      await os.Notifications.requestPermission();
    }

    if (Notification.permission !== "granted") return "denied";

    // Opt-in
    if (!os.User.PushSubscription.optedIn) {
      await os.User.PushSubscription.optIn();
    }

    // تحقق من الـ subscription token
    const token = os.User.PushSubscription.token;
    if (token) {
      console.log(LOG_PREFIX, `subscribeToPush ✓ externalId=${externalId} token=${token.slice(0, 20)}...`);
      return "ok";
    }

    // تسجيل مكتمل حتى بدون token (OneSignal يدير ذلك)
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
