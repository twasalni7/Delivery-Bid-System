import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", requireAuth(), async (req, res) => {
  const user = req.session.user!;
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
      .limit(50);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "notifications GET / error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.get("/unread-count", requireAuth(), async (req, res) => {
  const user = req.session.user!;
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.userRole, user.role),
          eq(notificationsTable.isRead, false)
        )
      );

    res.json({ count: rows.length });
  } catch (err) {
    logger.error({ err }, "notifications GET /unread-count error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.patch("/mark-all-read", requireAuth(), async (req, res) => {
  const user = req.session.user!;
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
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
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.patch("/:id/read", requireAuth(), async (req, res) => {
  const id = Number(req.params["id"]);
  const user = req.session.user!;

  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
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
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

export default router;
