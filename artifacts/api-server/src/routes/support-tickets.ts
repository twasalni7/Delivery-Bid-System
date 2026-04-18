import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, clientsTable, driversTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";

const router = Router();

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

// Client: submit ticket
router.post("/", requireAuth("client"), async (req, res) => {
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

  const [created] = await db
    .insert(supportTicketsTable)
    .values({
      clientId: sessionUser.id,
      type: type as "تأخير" | "دفع" | "إلغاء" | "أخرى",
      message: message.trim(),
      requestId: requestId ? Number(requestId) : undefined,
      status: "OPEN",
    })
    .returning();

  res.status(201).json(formatTicket(created));
});

// Client: get own tickets
router.get("/my", requireAuth("client"), async (req, res) => {
  const sessionUser = req.session.user!;
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.clientId, sessionUser.id))
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json(tickets.map((t) => formatTicket(t)));
});

// Admin: get all tickets
router.get("/", requireAuth("admin"), async (_req, res) => {
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
});

// Admin: reply and update ticket status
router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { adminReply, status } = req.body ?? {};
  const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (adminReply !== undefined) updates.adminReply = String(adminReply).trim();
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as string)) {
      res.status(400).json({ error: "حالة التذكرة غير صحيحة" });
      return;
    }
    updates.status = status;
  }

  const [updated] = await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "التذكرة غير موجودة" });
    return;
  }

  res.json(formatTicket(updated));
});

// Admin: delete ticket
router.delete("/:id", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const deleted = await db
    .delete(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .returning();
  if (!deleted.length) {
    res.status(404).json({ error: "التذكرة غير موجودة" });
    return;
  }
  res.json({ message: "تم حذف التذكرة" });
});

export default router;
