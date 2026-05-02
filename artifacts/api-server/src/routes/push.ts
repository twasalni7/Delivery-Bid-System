import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";

const router = Router();

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
 * POST /api/push/subscribe
 * Saves a push subscription for the currently logged-in user.
 * Body: { subscription: PushSubscriptionJSON }
 */
router.post("/subscribe", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  const { subscription } = req.body ?? {};

  if (!subscription || typeof subscription !== "object") {
    res.status(400).json({ error: "subscription مطلوب" });
    return;
  }

  const subscriptionJson = JSON.stringify(subscription);

  try {
    if (user.role === "client") {
      await db
        .update(clientsTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(clientsTable.id, user.id));
    } else if (user.role === "driver") {
      await db
        .update(driversTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(driversTable.id, user.id));
    } else if (user.role === "admin") {
      await db
        .update(adminsTable)
        .set({ pushSubscription: subscriptionJson })
        .where(eq(adminsTable.id, user.id));
    }

    res.json({ message: "تم حفظ الاشتراك في الإشعارات" });
  } catch {
    res.status(500).json({ error: "فشل حفظ الاشتراك" });
  }
});

export default router;
