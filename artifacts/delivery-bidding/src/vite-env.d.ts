/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ─── OneSignal v16 Web SDK ────────────────────────────────────────────────────

interface OneSignalNotifications {
  /** Whether push notifications are currently permitted by the browser */
  readonly permission: boolean;
  /** Request the native browser permission prompt */
  requestPermission(): Promise<void>;
}

interface OneSignalSlidedown {
  /** Show the OneSignal-hosted permission slidedown UI */
  promptPush(): Promise<void>;
}

interface OneSignalPushSubscription {
  optIn(): Promise<void>;
  optOut(): Promise<void>;
}

interface OneSignalUser {
  addTag(key: string, value: string): Promise<void>;
  addTags(tags: Record<string, string>): Promise<void>;
  readonly PushSubscription: OneSignalPushSubscription;
}

interface OneSignalNamespace {
  init(options: { appId: string; [key: string]: unknown }): Promise<void>;
  /** Link the current device's push subscription to an external user ID */
  login(externalId: string): Promise<void>;
  /** Unlink the current device from its external user ID */
  logout(): Promise<void>;
  readonly Notifications: OneSignalNotifications;
  readonly Slidedown: OneSignalSlidedown;
  readonly User: OneSignalUser;
}

interface Window {
  OneSignalDeferred: Array<(OneSignal: OneSignalNamespace) => void | Promise<void>>;
  /** Populated by OneSignal SDK after initialization */
  OneSignal?: OneSignalNamespace;
}

