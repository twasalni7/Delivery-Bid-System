import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { sendPushToUser } from "../lib/notify";
import { z } from "zod";

const router = Router();

const testPushSchema = z.object({
  title: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
});

/**
 * POST /api/debug/test-push
 * Sends a real push notification directly to the currently authenticated user.
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

  logger.info(
    {
      userId: user.id,
      userRole: role,
      provider: "web-push",
    },
    "[debug/test-push] starting"
  );

  const title = payload.title ?? "🔔 اختبار Push (debug)";
  const message = payload.message ?? "هذه رسالة اختبار حقيقية من السيرفر.";
  const url = payload.url ?? "/";

  const result = await sendPushToUser(user.id, role, {
    title,
    body: message,
    url,
    tag: "debug-test-push",
  });

  res.json({
    ok: result.sent,
    provider: "web-push",
    user: { id: user.id, role },
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
  });

  const parsedQuery = querySchema.safeParse(req.query ?? {});
  if (!parsedQuery.success) {
    res.status(400).json({ success: false, reason: "invalid_query", details: parsedQuery.error.flatten() });
    return;
  }

  const role = user.role as "client" | "driver" | "admin";
  const provider = "web-push";

  const title = parsedQuery.data.title ?? "🔔 اختبار Push (mobile)";
  const message = parsedQuery.data.message ?? "هذه رسالة اختبار حقيقية (من الجوال).";
  const url = parsedQuery.data.url ?? "/";

  logger.info(
    {
      userId: user.id,
      userRole: role,
      provider,
      title,
      url,
    },
    "[debug/test-push-mobile] starting"
  );

  const result = await sendPushToUser(user.id, role, {
    title,
    body: message,
    url,
    tag: "debug-test-push-mobile",
  });

  logger.info(
    {
      userId: user.id,
      userRole: role,
      provider,
      sent: result.sent,
    },
    "[debug/test-push-mobile] completed"
  );

  res.json({
    success: result.sent,
    reason: result.sent ? null : "no_push_subscription",
  });
});

export default router;
