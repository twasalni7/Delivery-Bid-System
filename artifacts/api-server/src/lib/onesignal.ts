import { logger } from "./logger";

// OneSignal REST API base URL.
// Modern OneSignal docs use https://api.onesignal.com/v1/* (note the /v1 prefix).
const DEFAULT_ONESIGNAL_API_URL = "https://api.onesignal.com/v1";

export type OneSignalPushPayload = {
  externalIds: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown> | null;
  /**
   * Additional context used for server-side debugging only (never sent to OneSignal).
   * Helps correlate DB notification records with provider delivery attempts.
   */
  context?: {
    userId?: number;
    userRole?: "client" | "driver" | "admin";
    notificationId?: number;
  };
};

export function buildOneSignalExternalId(
  userId: number,
  userRole: "client" | "driver" | "admin"
): string {
  return `${userRole}:${userId}`;
}

function normalizeOneSignalApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  // Allow either ".../v1" or ".../api/v1" as a fully-qualified base.
  if (trimmed.endsWith("/v1") || trimmed.endsWith("/api/v1")) return trimmed;
  // Most common misconfig: https://api.onesignal.com (missing /v1)
  return `${trimmed}/v1`;
}

export function getOneSignalConfig() {
  const appId =
    process.env["ONESIGNAL_APP_ID"] ??
    process.env["VITE_ONESIGNAL_APP_ID"] ??
    null;
  // Check both ONESIGNAL_API_KEY and ONESIGNAL_REST_API_KEY to avoid 403 errors
  const restApiKey =
    process.env["ONESIGNAL_REST_API_KEY"] ??
    process.env["ONESIGNAL_API_KEY"] ??
    null;
  const apiUrl = normalizeOneSignalApiBaseUrl(
    process.env["ONESIGNAL_API_URL"] ?? DEFAULT_ONESIGNAL_API_URL
  );

  if (!appId || !restApiKey) {
    if (!appId) {
      logger.warn("OneSignal: ONESIGNAL_APP_ID is not configured");
    }
    if (!restApiKey) {
      logger.warn("OneSignal: Neither ONESIGNAL_REST_API_KEY nor ONESIGNAL_API_KEY is configured");
    }
    return null;
  }

  logger.info("OneSignal: Configuration loaded successfully", {
    appId: appId.substring(0, 8) + "...",
    apiUrl,
  });

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
    logger.error("OneSignal: Cannot send push - configuration is missing");
    return { ok: false, status: null, response: { error: "OneSignal is not configured" } };
  }

  const pushDebug = process.env["PUSH_DEBUG"] === "true";

  logger.info("OneSignal: Sending push notification", {
    externalIds: payload.externalIds,
    title: payload.title,
    hasUrl: !!payload.url,
    ...payload.context,
  });

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

  if (pushDebug) {
    logger.info(
      { requestBody, externalIds: payload.externalIds, ...payload.context },
      "OneSignal: request payload"
    );
  }

  try {
    const response = await fetch(`${config.apiUrl}/notifications`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${config.restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const body = await response
      .json()
      .catch(async () => (await response.text().catch(() => null)));

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          body,
          externalIds: payload.externalIds,
          title: payload.title,
          ...payload.context,
        },
        "OneSignal: Push notification FAILED"
      );
    } else {
      logger.info(
        {
          status: response.status,
          externalIds: payload.externalIds,
          id: (body as Record<string, unknown> | null)?.["id"] ?? null,
          recipients: (body as Record<string, unknown> | null)?.["recipients"] ?? null,
          errors: (body as Record<string, unknown> | null)?.["errors"] ?? null,
          invalid_aliases: (body as Record<string, unknown> | null)?.["invalid_aliases"] ?? null,
          ...payload.context,
        },
        "OneSignal: Push notification accepted"
      );
    }

    if (pushDebug) {
      logger.info(
        { status: response.status, body, externalIds: payload.externalIds, ...payload.context },
        "OneSignal: raw response body"
      );
    }

    return {
      ok: response.ok,
      status: response.status,
      response: body,
    };
  } catch (err) {
    logger.error(
      { err, externalIds: payload.externalIds, title: payload.title, ...payload.context },
      "OneSignal: Push notification failed (network/exception)"
    );
    return { ok: false, status: null, response: { error: "onesignal_fetch_failed" } };
  }
}

export async function getOneSignalUserByExternalId(externalId: string): Promise<{
  ok: boolean;
  status: number | null;
  response: unknown;
}> {
  const config = getOneSignalConfig();
  if (!config) {
    return { ok: false, status: null, response: { error: "OneSignal is not configured" } };
  }

  // OneSignal "User Model" exposes lookup by alias (external_id).
  // We keep this best-effort (for production diagnosis), and return raw response for inspection.
  const url = new URL(`${config.apiUrl}/apps/${config.appId}/users/by/alias/external_id`);
  url.searchParams.set("alias_label", "external_id");
  url.searchParams.set("alias_id", externalId);

  const pushDebug = process.env["PUSH_DEBUG"] === "true";
  logger.info({ externalId }, "OneSignal: looking up user by external_id alias");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${config.restApiKey}`,
        "Content-Type": "application/json",
      },
    });
    const body = await response
      .json()
      .catch(async () => (await response.text().catch(() => null)));

    if (!response.ok) {
      logger.warn({ status: response.status, body, externalId }, "OneSignal: user lookup failed");
    } else if (pushDebug) {
      logger.info({ status: response.status, body, externalId }, "OneSignal: user lookup response");
    }

    return { ok: response.ok, status: response.status, response: body };
  } catch (err) {
    logger.warn({ err, externalId }, "OneSignal: user lookup failed (network/exception)");
    return { ok: false, status: null, response: { error: "onesignal_user_lookup_failed" } };
  }
}
