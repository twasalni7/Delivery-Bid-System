import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, clientsTable, driversTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { notify, notifyAllAdmins } from "../lib/notify";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

function formatTicket(t: typeof supportTicketsTable.$inferSelect, user?: { name: string } | null) {
  return {
    id: t.id,
    clientId: t.clientId,
    driverId: t.driverId,
    requestId: t.requestId,
    type: t.type,
    message: t.message,
    status: t.status,
    adminReply: t.adminReply,
    submitterName: user?.name ?? null,
    createdAt: t.createdAt?.toISOString(),
    updatedAt: t.updatedAt?.toISOString(),
  };
}

// Client or Driver: submit ticket
router.post("/", requireAuth(), async (req, res) => {
  const sessionUser = req.session.user!;
  const { type, message, requestId } = req.body ?? {};

  const VALID_TYPES = ["تأخير", "دفع", "إلغاء", "أخرى"];
  if (!type || !VALID_TYPES.includes(type as string)) {
    res.status(400).json({ error: "نوع التذكرة غير صحيح" });
    return;
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "الرسالة مطلوبة" });
    return;
  }

  const values: Record<string, unknown> = {
    type: type as "تأخير" | "دفع" | "إلغاء" | "أخرى",
    message: message.trim(),
    requestId: requestId ? Number(requestId) : undefined,
    status: "OPEN",
  };

  if (sessionUser.role === "client") {
    values.clientId = sessionUser.id;
  } else if (sessionUser.role === "driver") {
    values.driverId = sessionUser.id;
  } else {
    res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    return;
  }
  try {
    const [created] = await db
      .insert(supportTicketsTable)
      .values(values as typeof supportTicketsTable.$inferInsert)
      .returning();

    // Notify all admins about the new support ticket
    const submitterName = sessionUser.role === "client"
      ? (await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, sessionUser.id), columns: { name: true } }))?.name
      : (await db.query.driversTable.findFirst({ where: eq(driversTable.id, sessionUser.id), columns: { name: true } }))?.name;
    void notifyAllAdmins({
      title: "تذكرة دعم جديدة",
      message: `فتح ${submitterName ?? "مستخدم"} تذكرة دعم جديدة — النوع: ${String(type)}`,
      type: "support",
      relatedId: created.id,
      url: "/admin/support",
    });

    res.status(201).json(formatTicket(created));
  } catch (err) {
    logger.error({ err }, "support-tickets POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Client: get own tickets
router.get("/my", requireAuth("client"), async (req, res) => {
  try {
    const sessionUser = req.session.user!;
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.clientId, sessionUser.id))
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json(tickets.map((t) => formatTicket(t)));
  } catch (err) {
    logger.error({ err }, "support-tickets GET /my error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Driver: get own tickets
router.get("/driver/my", requireAuth("driver"), async (req, res) => {
  try {
    const sessionUser = req.session.user!;
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.driverId, sessionUser.id))
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json(tickets.map((t) => formatTicket(t)));
  } catch (err) {
    logger.error({ err }, "support-tickets GET /driver/my error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Admin: get all tickets
router.get("/", requireAuth("admin"), async (_req, res) => {
  try {
    const tickets = await db
      .select()
      .from(supportTicketsTable)
      .orderBy(desc(supportTicketsTable.createdAt));

    const results = await Promise.all(
      tickets.map(async (t) => {
        let user = null;
        if (t.clientId) {
          user = await db.query.clientsTable.findFirst({
            where: eq(clientsTable.id, t.clientId),
          });
        } else if (t.driverId) {
          user = await db.query.driversTable.findFirst({
            where: eq(driversTable.id, t.driverId),
          });
        }
        return formatTicket(t, user);
      })
    );
    res.json(results);
  } catch (err) {
    logger.error({ err }, "support-tickets GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Admin: reply and update ticket status
router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { adminReply, status } = req.body ?? {};
  const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "LIVE_SUPPORT"];

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (adminReply !== undefined) updates.adminReply = String(adminReply).trim();
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as string)) {
      res.status(400).json({ error: "حالة التذكرة غير صحيحة" });
      return;
    }
    updates.status = status;
  }
  try {
    const [updated] = await db
      .update(supportTicketsTable)
      .set(updates)
      .where(eq(supportTicketsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "التذكرة غير موجودة" });
      return;
    }

    // Notify the ticket submitter if admin added/updated a reply
    if (adminReply !== undefined) {
      if (updated.clientId) {
        void notify({
          userId: updated.clientId,
          userRole: "client",
          title: "رد الإدارة على تذكرة الدعم",
          message: `ردّت الإدارة على تذكرتك: "${String(adminReply).trim().substring(0, 80)}${String(adminReply).trim().length > 80 ? "..." : ""}"`,
          type: "support",
          relatedId: updated.id,
          url: "/client/support",
        });
      } else if (updated.driverId) {
        void notify({
          userId: updated.driverId,
          userRole: "driver",
          title: "رد الإدارة على تذكرة الدعم",
          message: `ردّت الإدارة على تذكرتك: "${String(adminReply).trim().substring(0, 80)}${String(adminReply).trim().length > 80 ? "..." : ""}"`,
          type: "support",
          relatedId: updated.id,
          url: "/driver/profile",
        });
      }
    }

    res.json(formatTicket(updated));
  } catch (err) {
    logger.error({ err }, "support-tickets PATCH /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Admin: delete ticket
router.delete("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  try {
    const deleted = await db
      .delete(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "التذكرة غير موجودة" });
      return;
    }
    res.json({ message: "تم حذف التذكرة" });
  } catch (err) {
    logger.error({ err }, "support-tickets DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
