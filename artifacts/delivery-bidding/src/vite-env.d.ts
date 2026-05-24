/// <reference types="vite/client" />
/// <reference types="google.maps" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    // Notification interaction tracking (used by sw.js → App.tsx)
    __pendingNotificationInteraction?: {
      notificationId: number;
      action: "open" | "action";
      url: string;
      payload?: Record<string, unknown>;
    };
  }
}

export {};
