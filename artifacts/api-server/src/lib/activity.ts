/**
 * Activity logging helper — records all significant system operations
 * to the activity_logs table for audit trail purposes.
 */
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import { logger } from "./logger";
import type { Request } from "express";

export interface LogActivityOptions {
  actorId?: number | null;
  actorRole?: string;
  action: string;
  entity: string;
  entityId?: number | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Inserts a row into activity_logs. Failures are silently swallowed so
 * that logging never breaks the primary request flow.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    const ipAddress =
      opts.req
        ? (opts.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
          opts.req.socket?.remoteAddress ??
          null
        : null;

    await db.insert(activityLogsTable).values({
      actorId:   opts.actorId ?? null,
      actorRole: opts.actorRole ?? "system",
      action:    opts.action,
      entity:    opts.entity,
      entityId:  opts.entityId ?? null,
      metadata:  opts.metadata ?? null,
      ipAddress: ipAddress ?? null,
    });
  } catch (err) {
    // Never propagate logging failures
    logger.warn({ err }, "logActivity: failed to write activity log");
  }
}
