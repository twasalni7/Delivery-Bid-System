/**
 * push-notifications.ts — OneSignal Integration
 * يستخدم OneSignal SDK بدل VAPID المباشر
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
}

interface OneSignalConfig {
  appId: string;
  serviceWorkerParam?: { scope: string };
  serviceWorkerPath?: string;
  notifyButton?: { enable: boolean };
  allowLocalhostAsSecureOrigin?: boolean;
}

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string;

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * تهيئة OneSignal — يُستدعى مرة واحدة عند تحميل التطبيق
 */
export async function initOneSignal(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  if (!ONESIGNAL_APP_ID) {
    console.warn(LOG_PREFIX, "VITE_ONESIGNAL_APP_ID غير موجود — الإشعارات معطلة");
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
        console.log(LOG_PREFIX, "OneSignal initialized ✓");
      } catch (err) {
        console.error(LOG_PREFIX, "OneSignal init failed:", err);
      }
      resolve();
    });

    // تحميل OneSignal SDK
    if (!document.getElementById("onesignal-sdk")) {
      const script = document.createElement("script");
      script.id = "onesignal-sdk";
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return initPromise;
}

/**
 * ربط المستخدم بـ OneSignal باستخدام external_id
 * يتم استدعاؤه عند تسجيل الدخول
 */
export async function loginOneSignal(userId: number, role: string): Promise<void> {
  const externalId = `${role}_${userId}`;
  try {
    await initOneSignal();
    const os = window.OneSignal;
    if (!os) return;

    await os.login(externalId);
    console.log(LOG_PREFIX, `OneSignal login ✓ externalId=${externalId}`);

    // طلب الإذن إذا لم يكن ممنوحاً
    if (!os.Notifications.permission) {
      await os.Notifications.requestPermission();
    }

    // Opt-in
    if (!os.User.PushSubscription.optedIn) {
      await os.User.PushSubscription.optIn();
    }
  } catch (err) {
    console.warn(LOG_PREFIX, "OneSignal login error:", err);
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

/** للتوافق مع الكود القديم */
export function clearPushSubscriptionCache(): void {
  localStorage.removeItem("push_subscribed");
}
