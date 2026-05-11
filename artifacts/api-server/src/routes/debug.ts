import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { buildOneSignalExternalId, isOneSignalConfigured, sendOneSignalPush, getOneSignalUserByExternalId } from "../lib/onesignal";
import { sendPushToUser } from "../lib/notify";
import { z } from "zod";

const router = Router();

function extractOneSignalDeliveryFields(
  oneSignalResult: { status: number | null; response: unknown } | null
): {
  recipients: unknown;
  errors: unknown;
  invalid_aliases: unknown;
  targetingMode: unknown;
  rawBody: unknown;
} {
  if (!oneSignalResult) {
    return {
      recipients: null,
      errors: null,
      invalid_aliases: null,
      targetingMode: null,
      rawBody: null,
    };
  }

  const wrapped = oneSignalResult.response as
    | { targetingMode?: unknown; body?: unknown }
    | Record<string, unknown>
    | null;

  const targetingMode =
    wrapped && typeof wrapped === "object" && "targetingMode" in wrapped
      ? (wrapped as { targetingMode?: unknown }).targetingMode ?? null
      : null;

  const body =
    wrapped && typeof wrapped === "object" && "body" in wrapped
      ? (wrapped as { body?: unknown }).body ?? null
      : oneSignalResult.response;

  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  return {
    recipients: bodyObj?.["recipients"] ?? null,
    errors: bodyObj?.["errors"] ?? null,
    invalid_aliases: bodyObj?.["invalid_aliases"] ?? null,
    targetingMode,
    rawBody: body,
  };
}

function inferFailureReason(params: {
  provider: "onesignal" | "web-push";
  oneSignalResult?: { ok: boolean; status: number | null; response: unknown } | null;
  legacySent?: boolean | null;
}): string | null {
  if (params.provider === "web-push") {
    if (params.legacySent === true) return null;
    return "web_push_not_sent";
  }

  const result = params.oneSignalResult;
  if (!result) return "onesignal_missing_result";
  if (result.ok) return null;
  if (result.status === null) {
    const resp = result.response as Record<string, unknown> | null;
    const err = resp && typeof resp === "object" ? String(resp["error"] ?? "onesignal_unknown_error") : "onesignal_unknown_error";
    return err;
  }
  return `onesignal_http_${result.status}`;
}

const testPushSchema = z.object({
  title: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
  /**
   * Optional client-side identifiers (for correlation only).
   * Can be provided by the PWA (OneSignal.User.PushSubscription.id/token).
   */
  clientSubscriptionId: z.string().trim().min(1).optional(),
  clientPushTokenPrefix: z.string().trim().min(1).optional(),
  lookupUser: z.boolean().optional(),
});

/**
 * POST /api/debug/test-push
 * Sends a real push notification directly to the currently authenticated user.
 *
 * هدفه: تشخيص Production بشكل مباشر بإظهار:
 * - external user id المستخدم للاستهداف
 * - payload المرسل
 * - response الخام من OneSignal (recipients/errors/invalid_aliases/id)
 */
router.post("/test-push", requireAuth(), async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = testPushSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;
  const role = user.role as "client" | "driver" | "admin";
  const externalUserId = buildOneSignalExternalId(user.id, role);

  logger.info(
    {
      userId: user.id,
      userRole: role,
      externalUserId,
      clientSubscriptionId: payload.clientSubscriptionId ?? null,
      clientPushTokenPrefix: payload.clientPushTokenPrefix ?? null,
      provider: isOneSignalConfigured() ? "onesignal" : "web-push",
    },
    "[debug/test-push] starting"
  );

  const title = payload.title ?? "🔔 اختبار Push (debug)";
  const message = payload.message ?? "هذه رسالة اختبار حقيقية من السيرفر.";
  const url = payload.url ?? "/";

  const oneSignalUser =
    payload.lookupUser === false || !isOneSignalConfigured()
      ? null
      : await getOneSignalUserByExternalId(externalUserId);

  if (isOneSignalConfigured()) {
    const result = await sendOneSignalPush({
      externalIds: [externalUserId],
      title,
      message,
      url,
      data: {
        tag: "debug-test-push",
        userRole: role,
      },
      context: { userId: user.id, userRole: role },
    });

    res.json({
      ok: result.ok,
      provider: "onesignal",
      user: { id: user.id, role },
      externalUserId,
      oneSignalUserLookup: oneSignalUser,
      oneSignalResponse: result,
    });
    return;
  }

  // Fallback for environments without OneSignal configuration (legacy web-push).
  const legacy = await sendPushToUser(user.id, role, {
    title,
    body: message,
    url,
    tag: "debug-test-push",
  });

  res.json({
    ok: legacy.sent,
    provider: "web-push",
    user: { id: user.id, role },
    externalUserId,
  });
});

/**
 * GET /api/debug/test-push-mobile
 * Mobile-friendly endpoint: uses session cookies and does not require POST/DevTools.
 *
 * Query params (optional): ?title=...&message=...&url=...
 */
router.get("/test-push-mobile", requireAuth(), async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ success: false, reason: "unauthorized" });
    return;
  }

  const querySchema = z.object({
    title: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    lookupUser: z
      .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
      .optional(),
  });

  const parsedQuery = querySchema.safeParse(req.query ?? {});
  if (!parsedQuery.success) {
    res.status(400).json({ success: false, reason: "invalid_query", details: parsedQuery.error.flatten() });
    return;
  }

  const role = user.role as "client" | "driver" | "admin";
  const externalId = buildOneSignalExternalId(user.id, role);
  const provider: "onesignal" | "web-push" = isOneSignalConfigured() ? "onesignal" : "web-push";

  const title = parsedQuery.data.title ?? "🔔 اختبار Push (mobile)";
  const message = parsedQuery.data.message ?? "هذه رسالة اختبار حقيقية (من الجوال).";
  const url = parsedQuery.data.url ?? "/";

  logger.info(
    {
      userId: user.id,
      userRole: role,
      externalId,
      provider,
      title,
      url,
    },
    "[debug/test-push-mobile] starting"
  );

  if (provider === "onesignal") {
    const shouldLookupUser = parsedQuery.data.lookupUser !== "false" && parsedQuery.data.lookupUser !== "0";
    const oneSignalUserLookup = shouldLookupUser
      ? await getOneSignalUserByExternalId(externalId)
      : null;

    const oneSignalResponse = await sendOneSignalPush({
      externalIds: [externalId],
      title,
      message,
      url,
      data: {
        tag: "debug-test-push-mobile",
        userRole: role,
      },
      context: { userId: user.id, userRole: role },
    });

    const extracted = extractOneSignalDeliveryFields(oneSignalResponse);
    const reason = inferFailureReason({ provider, oneSignalResult: oneSignalResponse });

    logger.info(
      {
        userId: user.id,
        userRole: role,
        externalId,
        provider,
        ok: oneSignalResponse.ok,
        status: oneSignalResponse.status,
        recipients: extracted.recipients,
        errors: extracted.errors,
        invalid_aliases: extracted.invalid_aliases,
        targetingMode: extracted.targetingMode,
        reason,
      },
      "[debug/test-push-mobile] completed"
    );

    res.json({
      success: oneSignalResponse.ok,
      externalId,
      oneSignalUserLookup,
      oneSignalResponse,
      recipients: extracted.recipients,
      errors: extracted.errors,
      invalid_aliases: extracted.invalid_aliases,
      reason,
    });
    return;
  }

  // Fallback for environments without OneSignal configuration (legacy web-push).
  const legacy = await sendPushToUser(user.id, role, {
    title,
    body: message,
    url,
    tag: "debug-test-push-mobile",
  });

  const reason = inferFailureReason({ provider, legacySent: legacy.sent });

  logger.info(
    {
      userId: user.id,
      userRole: role,
      externalId,
      provider,
      legacySent: legacy.sent,
      reason,
    },
    "[debug/test-push-mobile] completed (legacy)"
  );

  res.json({
    success: legacy.sent,
    externalId,
    oneSignalResponse: null,
    recipients: null,
    errors: null,
    invalid_aliases: null,
    reason,
  });
});

export default router;
