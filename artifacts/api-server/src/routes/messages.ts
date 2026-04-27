import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, requestsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

/**
 * Verify the requesting user is authorized to read/write messages for a request.
 * - Admins: always.
 * - Client: must own the request.
 * - Driver: must be the selectedDriver AND status must be post-selection.
 */
async function canAccessMessages(
  requestId: number,
  sessionUser: { id: number; role: string }
): Promise<boolean> {
  if (sessionUser.role === "admin") return true;

  const request = await db.query.requestsTable.findFirst({
    where: eq(requestsTable.id, requestId),
  });

  if (!request) return false;

  if (sessionUser.role === "client") {
    return request.clientId === sessionUser.id;
  }

  if (sessionUser.role === "driver") {
    const postSelection =
      request.status === "SELECTED" ||
      request.status === "ACTIVE" ||
      request.status === "COMPLETED";
    return request.selectedDriverId === sessionUser.id && postSelection;
  }

  return false;
}

// GET /api/messages/:requestId — fetch all messages for a request
router.get("/:requestId", requireAuth(), async (req, res) => {
  const requestId = Number(req.params["requestId"]);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  try {
    const allowed = await canAccessMessages(requestId, sessionUser);
    if (!allowed) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.requestId, requestId))
      .orderBy(asc(messagesTable.createdAt));

    res.json(
      msgs.map((m) => ({
        id: m.id,
        requestId: m.requestId,
        senderRole: m.senderRole,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "messages GET /:requestId error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// POST /api/messages/:requestId — send a message
router.post("/:requestId", requireAuth(), async (req, res) => {
  const requestId = Number(req.params["requestId"]);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { body } = req.body ?? {};
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "نص الرسالة مطلوب" });
    return;
  }

  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  try {
    const allowed = await canAccessMessages(requestId, sessionUser);
    if (!allowed) {
      res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
      return;
    }

    const [created] = await db
      .insert(messagesTable)
      .values({
        requestId,
        senderRole: sessionUser.role as "client" | "driver" | "admin",
        senderId: sessionUser.id,
        body: body.trim(),
      })
      .returning();

    res.status(201).json({
      id: created.id,
      requestId: created.requestId,
      senderRole: created.senderRole,
      senderId: created.senderId,
      body: created.body,
      createdAt: created.createdAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "messages POST /:requestId error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
