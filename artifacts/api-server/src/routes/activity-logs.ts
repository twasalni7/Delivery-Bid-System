import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import { desc, and, eq, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// ─── GET /activity-logs ───────────────────────────────────────────────────────
// Admin: list activity logs with optional filtering and pagination

router.get("/", requireAuth("admin"), async (req, res) => {
  try {
    const page      = Math.max(1, parseInt(req.query["page"] as string) || 1);
    const pageSize  = Math.min(100, Math.max(1, parseInt(req.query["pageSize"] as string) || 50));
    const offset    = (page - 1) * pageSize;

    const actorRole = req.query["actorRole"] as string | undefined;
    const action    = req.query["action"]    as string | undefined;
    const entity    = req.query["entity"]    as string | undefined;
    const from      = req.query["from"]      as string | undefined;
    const to        = req.query["to"]        as string | undefined;

    const filters = [];
    if (actorRole) filters.push(eq(activityLogsTable.actorRole, actorRole));
    if (action)    filters.push(eq(activityLogsTable.action, action));
    if (entity)    filters.push(eq(activityLogsTable.entity, entity));
    if (from)      filters.push(gte(activityLogsTable.createdAt, new Date(from)));
    if (to)        filters.push(lte(activityLogsTable.createdAt, new Date(to)));

    const query = db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const rows = filters.length > 0
      ? await query.where(and(...filters))
      : await query;

    res.json({
      page,
      pageSize,
      data: rows.map((r) => ({
        id:        r.id,
        actorId:   r.actorId,
        actorRole: r.actorRole,
        action:    r.action,
        entity:    r.entity,
        entityId:  r.entityId,
        metadata:  r.metadata,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt?.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "activity-logs GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
