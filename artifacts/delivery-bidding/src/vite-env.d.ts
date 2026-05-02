/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface OneSignalNamespace {
  init(options: { appId: string; [key: string]: unknown }): Promise<void>;
}

interface Window {
  OneSignalDeferred: Array<(OneSignal: OneSignalNamespace) => void | Promise<void>>;
}
