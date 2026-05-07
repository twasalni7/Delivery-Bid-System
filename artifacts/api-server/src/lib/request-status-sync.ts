import { db, requestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  logRequestStatusTransition,
  resolveRequestStatus,
  type RequestStatus,
} from "./request-status-engine";
import { logger } from "./logger";

// Delay first run briefly so startup DB work settles before sync kicks in.
const STARTUP_DELAY_MS = 60 * 1000;
// Run every 30 minutes to correct inconsistencies without excessive DB churn.
const INTERVAL_MS = 30 * 60 * 1000;

export async function runRequestStatusSync(): Promise<number> {
  try {
    const requests = await db
      .select({
        id: requestsTable.id,
        status: requestsTable.status,
        selectedDriverId: requestsTable.selectedDriverId,
        needsAdminReview: requestsTable.needsAdminReview,
      })
      .from(requestsTable);

    let updatedCount = 0;
    for (const row of requests) {
      const { status: nextStatus, reason } = resolveRequestStatus({
        currentStatus: row.status as RequestStatus,
        selectedDriverId: row.selectedDriverId,
        needsAdminReview: row.needsAdminReview,
        event: "background_sync",
      });

      if (nextStatus === row.status) continue;

      const [updated] = await db
        .update(requestsTable)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(requestsTable.id, row.id))
        .returning({ id: requestsTable.id, status: requestsTable.status });

      if (!updated) continue;
      updatedCount += 1;
      logRequestStatusTransition({
        requestId: row.id,
        previousStatus: row.status as RequestStatus,
        nextStatus,
        reason,
        event: "background_sync",
      });
    }

    if (updatedCount > 0) {
      logger.info({ updatedCount }, "request status sync completed");
    }
    return updatedCount;
  } catch (err) {
    logger.error({ err }, "request status sync failed");
    return 0;
  }
}

export function startRequestStatusSyncJob(): void {
  const timer = setTimeout(() => {
    void runRequestStatusSync();
    const interval = setInterval(() => void runRequestStatusSync(), INTERVAL_MS);
    if (interval.unref) interval.unref();
  }, STARTUP_DELAY_MS);
  if (timer.unref) timer.unref();
}
