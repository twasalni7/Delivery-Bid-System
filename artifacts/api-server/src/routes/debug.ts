import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { buildOneSignalExternalId, isOneSignalConfigured, sendOneSignalPush, getOneSignalUserByExternalId } from "../lib/onesignal";
import { sendPushToUser } from "../lib/notify";
import { z } from "zod";

const router = Router();

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

export default router;

