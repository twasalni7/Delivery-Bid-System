import { logger } from "./logger";

const DEFAULT_ONESIGNAL_API_URL = "https://api.onesignal.com";

export type OneSignalPushPayload = {
  externalIds: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown> | null;
};

export function buildOneSignalExternalId(
  userId: number,
  userRole: "client" | "driver" | "admin"
): string {
  return `${userRole}:${userId}`;
}

export function getOneSignalConfig() {
  const appId =
    process.env["ONESIGNAL_APP_ID"] ??
    process.env["VITE_ONESIGNAL_APP_ID"] ??
    null;
  const restApiKey = process.env["ONESIGNAL_REST_API_KEY"] ?? null;
  const apiUrl = (process.env["ONESIGNAL_API_URL"] ?? DEFAULT_ONESIGNAL_API_URL).replace(/\/+$/, "");

  if (!appId || !restApiKey) return null;

  return {
    appId,
    restApiKey,
    apiUrl,
  };
}

export function isOneSignalConfigured(): boolean {
  return Boolean(getOneSignalConfig());
}

export async function sendOneSignalPush(payload: OneSignalPushPayload): Promise<{
  ok: boolean;
  status: number | null;
  response: unknown;
}> {
  const config = getOneSignalConfig();
  if (!config) {
    return { ok: false, status: null, response: { error: "OneSignal is not configured" } };
  }

  const requestBody: Record<string, unknown> = {
    app_id: config.appId,
    include_aliases: { external_id: payload.externalIds },
    target_channel: "push",
    headings: { en: payload.title },
    contents: { en: payload.message },
    isAnyWeb: true,
  };

  if (payload.url) {
    requestBody["url"] = payload.url;
    requestBody["web_url"] = payload.url;
  }

  if (payload.data && Object.keys(payload.data).length > 0) {
    requestBody["data"] = payload.data;
    requestBody["custom_data"] = payload.data;
  }

  const response = await fetch(`${config.apiUrl}/notifications?c=push`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${config.restApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    logger.warn(
      { status: response.status, body, externalIds: payload.externalIds },
      "onesignal: failed to send push notification"
    );
  }

  return {
    ok: response.ok,
    status: response.status,
    response: body,
  };
}
