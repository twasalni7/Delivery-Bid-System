import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

router.get("/", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50), 1), 200);
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0);
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role)
        )
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "notifications GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/unread-count", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  try {
    const [result] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role),
          eq(notificationsTable.isRead, false)
        )
      );

    res.json({ count: Number(result?.count ?? 0) });
  } catch (err) {
    logger.error({ err }, "notifications GET /unread-count error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/mark-all-read", requireAuth(), async (req, res) => {
  const user = getSessionUser(req)!;
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role),
          eq(notificationsTable.isRead, false)
        )
      );

    res.json({ message: "تم تحديد جميع الإشعارات كمقروءة" });
  } catch (err) {
    logger.error({ err }, "notifications PATCH /mark-all-read error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id/read", requireAuth(), async (req, res) => {
  const id = Number(req.params["id"]);
  const user = getSessionUser(req)!;

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role)
        )
      );

    res.json({ message: "تم تحديد الإشعار كمقروء" });
  } catch (err) {
    logger.error({ err }, "notifications PATCH /:id/read error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/:id/clicked", requireAuth(), async (req, res) => {
  const id = Number(req.params["id"]);
  const user = getSessionUser(req)!;

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    await db
      .update(notificationsTable)
      .set({
        clickedAt: new Date(),
        interactedAt: new Date(),
        interactionSource: "in_app",
        interactionType: "open",
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role)
        )
      );

    res.json({ message: "تم تسجيل النقر على الإشعار" });
  } catch (err) {
    logger.error({ err }, "notifications PATCH /:id/clicked error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.post("/:id/interact", requireAuth(), async (req, res) => {
  const id = Number(req.params["id"]);
  const user = getSessionUser(req)!;
  const source = req.body?.source === "push" ? "push" : "in_app";
  const action = req.body?.action === "action" ? "action" : "open";

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    logger.info({ notificationId: id, userId: user.id, userRole: user.role, source, action }, "notifications: tracking interaction");
    await db
      .update(notificationsTable)
      .set({
        clickedAt: new Date(),
        interactedAt: new Date(),
        interactionSource: source,
        interactionType: action,
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role)
        )
      );

    res.json({ message: "تم تسجيل التفاعل مع الإشعار" });
  } catch (err) {
    logger.error({ err, notificationId: id, userId: user.id, userRole: user.role }, "notifications POST /:id/interact error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
