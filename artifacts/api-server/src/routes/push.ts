import { Router } from "express";
import { db, pool } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, isNotNull, count, isNull, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { notify } from "../lib/notify";
import {
  ensureNotificationUserExists,
  getNotificationTargetingMetadata,
  resolveNotificationRecipients,
  type NotificationAudience,
  type NotificationUserRole,
} from "../lib/notification-targeting";
import { z } from "zod";

const router = Router();

const roleSchema = z.enum(["client", "driver", "admin"]);
const filterOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_null",
  "not_null",
]);

const filterSchema = z.object({
  field: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.unknown().optional(),
});

const audienceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("roles"),
    roles: z.array(roleSchema).min(1),
  }),
  z.object({
    mode: z.literal("user"),
    userId: z.number().int().positive(),
    userRole: roleSchema,
  }),
  z.object({
    mode: z.literal("filters"),
    segments: z.array(
      z.object({
        role: roleSchema,
        filters: z.array(filterSchema).min(1),
      })
    ).min(1),
  }),
]);

const sendRequestSchema = z.object({
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  type: z.enum(["offer", "request", "system", "support"]).default("system"),
  url: z.string().trim().min(1).optional(),
  actionType: z.enum(["open_url", "emit_event"]).default("open_url"),
  actionLabel: z.string().trim().min(1).optional(),
  actionPayload: z.record(z.unknown()).optional(),
  audience: audienceSchema,
});

function normalizeLegacyAudience(body: Record<string, unknown>): NotificationAudience | null {
  const target = body["target"];
  if (target === "user") {
    const userId = Number(body["userId"]);
    const userRole = body["userRole"];
    if (!Number.isFinite(userId) || !roleSchema.safeParse(userRole).success) return null;
    return { mode: "user", userId, userRole: userRole as NotificationUserRole };
  }
  if (target === "all_drivers") return { mode: "roles", roles: ["driver"] };
  if (target === "all_admins") return { mode: "roles", roles: ["admin"] };
  if (target === "all_users") return { mode: "all" };
  return null;
}

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for the frontend to use with pushManager.subscribe.
 */
router.get("/vapid-public-key", (_req, res) => {
  const key = process.env["VAPID_PUBLIC_KEY"];
  if (!key) {
    res.status(503).json({ error: "Push notifications are not configured on this server" });
    return;
  }
  res.json({ publicKey: key });
});

/**
 * Normalizes any common PushSubscription shape received from browsers or
 * client code into the canonical form expected by the server:
 *   { endpoint: string, expirationTime: number|null, keys: { p256dh, auth } }
 *
 * Handles (in order of preference):
 *   1. { subscription: { endpoint, keys } }          — standard wrapped format sent by our frontend
 *   2. { endpoint, keys }                             — flat / direct format
 *   3. { subscription: { subscription: { … } } }     — double-nested (defensive)
 *   4. { endpoint, p256dh, auth }                    — keys at top-level (some older push providers)
 *
 * Returns null when no valid subscription can be extracted.
 */
function normalizePushSubscription(body: unknown): {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // Build a list of candidate objects to try, from most to least specific.
  const candidates: unknown[] = [
    b["subscription"],
    b,
    b["subscription"] && typeof b["subscription"] === "object"
      ? (b["subscription"] as Record<string, unknown>)["subscription"]
      : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const sub = candidate as Record<string, unknown>;

    if (typeof sub["endpoint"] !== "string" || !sub["endpoint"]) continue;

    const expTime =
      typeof sub["expirationTime"] === "number" ? sub["expirationTime"] : null;

    // Standard: keys nested under { keys: { p256dh, auth } }
    if (sub["keys"] && typeof sub["keys"] === "object") {
      const k = sub["keys"] as Record<string, unknown>;
      if (typeof k["p256dh"] === "string" && typeof k["auth"] === "string") {
        return {
          endpoint: sub["endpoint"],
          expirationTime: expTime,
          keys: { p256dh: k["p256dh"], auth: k["auth"] },
        };
      }
    }

    // Fallback: p256dh / auth at top level of the subscription object
    if (typeof sub["p256dh"] === "string" && typeof sub["auth"] === "string") {
      return {
        endpoint: sub["endpoint"],
        expirationTime: expTime,
        keys: { p256dh: sub["p256dh"], auth: sub["auth"] },
      };
    }
  }

  return null;
}

function shouldFallbackToLegacyPushSave(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const dbErr = err as { code?: string; message?: string };
  if (dbErr.code === "42703" || dbErr.code === "42P10") return true;
  const message = dbErr.message?.toLowerCase() ?? "";
  return message.includes("user_role") || message.includes("on conflict");
}

async function savePushSubscription(
  userId: number,
  userRole: string,
  normalized: { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } }
) {
  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId,
        userRole,
        subscriptionData: normalized as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptionsTable.userId, pushSubscriptionsTable.userRole],
        set: { subscriptionData: sql`excluded.subscription_data` },
      });
    return;
  } catch (err) {
    if (!shouldFallbackToLegacyPushSave(err)) {
      throw err;
    }

    logger.warn(
      { err, userId, userRole },
      "push/subscribe: modern schema unavailable, falling back to legacy push_subscriptions save"
    );

    const payload = JSON.stringify(normalized);
    const updateResult = await pool.query(
      `UPDATE push_subscriptions
          SET subscription_data = $2::jsonb
        WHERE user_id = $1`,
      [userId, payload]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, subscription_data)
         VALUES ($1, $2::jsonb)`,
        [userId, payload]
      );
    }
  }
}

/**
 * POST /api/push/subscribe
 * Saves (or updates) a push subscription for the currently logged-in user.
 * Reads the user from req.tokenUser (Bearer token) or req.session.user.
 * Body: { subscription: PushSubscriptionJSON }
 *
 * Automatically normalizes any common PushSubscription format before saving.
 * Uses INSERT … ON CONFLICT DO UPDATE so that re-subscribing the same device
 * only updates the existing row (no duplicates).
 *
 * Set PUSH_DEBUG=true in env to enable verbose structured logging.
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  const rawBody: unknown = req.body ?? {};
  const pushDebug = process.env["PUSH_DEBUG"] === "true";

  // ── 1. Structured log of receipt (always on) ──────────────────────────────
  logger.info(
    {
      userId: user.id,
      userRole: user.role,
      ...(pushDebug && {
        bodyKeys:
          rawBody && typeof rawBody === "object" ? Object.keys(rawBody as object) : [],
        hasSubscriptionKey:
          rawBody != null && typeof rawBody === "object" && "subscription" in (rawBody as object),
        hasEndpointKey:
          rawBody != null && typeof rawBody === "object" && "endpoint" in (rawBody as object),
      }),
    },
    "push/subscribe: request received"
  );

  // ── 2. Normalize and validate ──────────────────────────────────────────────
  const normalized = normalizePushSubscription(rawBody);

  if (!normalized) {
    logger.warn(
      {
        userId: user.id,
        userRole: user.role,
        bodyKeys:
          rawBody && typeof rawBody === "object" ? Object.keys(rawBody as object) : [],
      },
      "push/subscribe: invalid subscription — normalization failed (missing endpoint or keys)"
    );
    res.status(400).json({ error: "بيانات الاشتراك غير صحيحة أو ناقصة (endpoint أو keys مفقودة)" });
    return;
  }

  if (pushDebug) {
    logger.info(
      {
        userId: user.id,
        userRole: user.role,
        endpointPrefix: normalized.endpoint.substring(0, 50),
        hasAuth: Boolean(normalized.keys.auth),
        hasP256dh: Boolean(normalized.keys.p256dh),
      },
      "push/subscribe: subscription normalized successfully"
    );
  }

  // ── 3. Persist ─────────────────────────────────────────────────────────────
  try {
    await savePushSubscription(user.id, user.role, normalized);

    logger.info(
      { userId: user.id, userRole: user.role },
      "push/subscribe: saved successfully"
    );
    res.json({ message: "تم حفظ الاشتراك في الإشعارات" });
  } catch (err) {
    logger.error({ err, userId: user.id, userRole: user.role }, "push/subscribe: DB save failed");
    res.status(500).json({ error: "فشل حفظ الاشتراك في الإشعارات" });
  }
});

/**
 * GET /api/push/debug
 * Admin-only endpoint that returns push notification system diagnostics:
 * subscription counts per role, VAPID configuration status, and
 * a summary of endpoints currently registered.
 */
router.get("/debug", requireAuth("admin"), async (_req, res) => {
  const vapidConfigured = Boolean(
    process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]
  );

  try {
    const [clientCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "client"));

    const [driverCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "driver"));

    const [adminCount] = await db
      .select({ count: count() })
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userRole, "admin"));

    // Collect the last 10 registered endpoints per role (endpoint only, no keys)
    const rows = await db
      .select({
        userId: pushSubscriptionsTable.userId,
        userRole: pushSubscriptionsTable.userRole,
        subscriptionData: pushSubscriptionsTable.subscriptionData,
      })
      .from(pushSubscriptionsTable)
      .limit(30);

    function extractEndpoint(data: unknown): string | null {
      if (!data || typeof data !== "object") return null;
      const obj = data as { endpoint?: string };
      return obj.endpoint ?? null;
    }

    const devices = rows.map((r) => ({
      role: r.userRole,
      userId: r.userId,
      endpoint: extractEndpoint(r.subscriptionData),
    }));

    res.json({
      vapidConfigured,
      vapidPublicKey: process.env["VAPID_PUBLIC_KEY"] ?? null,
      subscriptions: {
        clients: Number(clientCount?.count ?? 0),
        drivers: Number(driverCount?.count ?? 0),
        admins: Number(adminCount?.count ?? 0),
        total:
          Number(clientCount?.count ?? 0) +
          Number(driverCount?.count ?? 0) +
          Number(adminCount?.count ?? 0),
      },
      devices,
    });
  } catch (err) {
    logger.error({ err }, "push/debug: failed to fetch stats");
    res.status(500).json({ error: "فشل جلب إحصائيات الإشعارات" });
  }
});

router.get("/targeting-metadata", requireAuth("admin"), async (_req, res) => {
  try {
    const metadata = await getNotificationTargetingMetadata();
    res.json(metadata);
  } catch (err) {
    logger.error({ err }, "push/targeting-metadata: failed to build metadata");
    res.status(500).json({ error: "فشل جلب خيارات الاستهداف" });
  }
});

/**
 * POST /api/push/unsubscribe
 * Removes the push subscription for the currently logged-in user.
 */
router.post("/unsubscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;

  try {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, user.id),
          eq(pushSubscriptionsTable.userRole, user.role)
        )
      );

    logger.info({ userId: user.id, role: user.role }, "push: subscription removed");
    res.json({ message: "تم إلغاء الاشتراك في الإشعارات" });
  } catch (err) {
    logger.error({ err, userId: user.id, role: user.role }, "push: failed to remove subscription");
    res.status(500).json({ error: "فشل إلغاء الاشتراك" });
  }
});

/**
 * POST /api/push/send
 * Admin-only: sends a push notification to a specific user, all drivers, or all admins.
 * Body: {
 *   target: "user" | "all_drivers" | "all_admins",
 *   userId?: number,
 *   userRole?: "client" | "driver" | "admin",
 *   title: string,
 *   message: string,
 *   url?: string,
 * }
 */
router.post("/send", requireAuth("admin"), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const legacyAudience = body["audience"] ? undefined : normalizeLegacyAudience(body);

  if (!body["audience"] && !legacyAudience) {
    res.status(400).json({ error: "صيغة الاستهداف القديمة غير صحيحة" });
    return;
  }

  const normalizedPayload = body["audience"]
    ? body
    : {
        title: body["title"],
        message: body["message"],
        type: "system",
        url: body["url"],
        actionType: "open_url",
        audience: legacyAudience,
      };

  const parsed = sendRequestSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    res.status(400).json({
      error: "بيانات الإشعار أو الاستهداف غير صحيحة",
      details: parsed.error.flatten(),
    });
    return;
  }

  const payload = parsed.data;

  try {
    if (payload.audience.mode === "user") {
      const exists = await ensureNotificationUserExists(payload.audience.userId, payload.audience.userRole);
      if (!exists) {
        res.status(404).json({ error: "المستخدم المستهدف غير موجود" });
        return;
      }
    }

    logger.info(
      {
        audience: payload.audience,
        title: payload.title,
        type: payload.type,
        actionType: payload.actionType,
      },
      "push/send: resolving recipients"
    );

    const recipients = await resolveNotificationRecipients(payload.audience);
    if (recipients.length === 0) {
      logger.warn({ audience: payload.audience }, "push/send: no recipients matched audience");
      res.status(400).json({ error: "لم يتم العثور على مستخدمين مطابقين لقواعد الاستهداف" });
      return;
    }

    logger.info(
      {
        audience: payload.audience,
        recipientCount: recipients.length,
        recipientsByRole: recipients.reduce<Record<string, number>>((acc, recipient) => {
          acc[recipient.role] = (acc[recipient.role] ?? 0) + 1;
          return acc;
        }, {}),
      },
      "push/send: recipients resolved"
    );

    await Promise.all(
      recipients.map((recipient) =>
        notify({
          userId: recipient.id,
          userRole: recipient.role,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          url: payload.url,
          actionType: payload.actionType,
          actionLabel: payload.actionLabel,
          actionPayload: payload.actionPayload ?? null,
        })
      )
    );

    logger.info(
      {
        recipientCount: recipients.length,
        audience: payload.audience,
      },
      "push/send: notification dispatch queued"
    );

    res.json({
      message: "تم إرسال الإشعار",
      recipientCount: recipients.length,
      recipientsByRole: recipients.reduce<Record<string, number>>((acc, recipient) => {
        acc[recipient.role] = (acc[recipient.role] ?? 0) + 1;
        return acc;
      }, {}),
      sampleRecipients: recipients.slice(0, 10).map((recipient) => ({
        id: recipient.id,
        role: recipient.role,
        name: recipient.name,
        subtitle: recipient.subtitle,
      })),
    });
  } catch (err) {
    logger.error({ err, payload }, "push/send: failed to dispatch notification");
    res.status(500).json({ error: "فشل إرسال الإشعار" });
  }
});

/**
 * GET /api/push/analytics
 * Admin-only: returns notification delivery and engagement statistics.
 */
router.get("/analytics", requireAuth("admin"), async (_req, res) => {
  try {
    const [totalResult] = await db
      .select({ count: count() })
      .from(notificationsTable);

    const [deliveredResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.deliveredAt));

    const [clickedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNotNull(notificationsTable.clickedAt));

    const [failedResult] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(isNull(notificationsTable.deliveredAt));

    const total     = Number(totalResult?.count ?? 0);
    const delivered = Number(deliveredResult?.count ?? 0);
    const clicked   = Number(clickedResult?.count ?? 0);
    const failed    = Number(failedResult?.count ?? 0);

    res.json({
      total,
      delivered,
      failed,
      clicked,
      deliveryRate: total > 0 ? `${((delivered / total) * 100).toFixed(1)}%` : "0%",
      clickRate:    delivered > 0 ? `${((clicked / delivered) * 100).toFixed(1)}%` : "0%",
    });
  } catch (err) {
    logger.error({ err }, "push/analytics: failed to fetch stats");
    res.status(500).json({ error: "فشل جلب إحصائيات الإشعارات" });
  }
});

export default router;
