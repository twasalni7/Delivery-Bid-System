/**
 * Cleanup jobs — run periodic housekeeping tasks on the database.
 *
 * Jobs:
 *   1. Push subscription cleanup  — daily, removes stale push tokens
 *   2. Expired user_tokens cleanup — daily, removes expired auth tokens
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";

const STALE_DAYS = 30;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000;  // 5 minutes after boot

// ─── Job 1: Push subscription cleanup ────────────────────────────────────────

async function runPushCleanup(): Promise<void> {
  logger.info("push cleanup: starting stale subscription cleanup");

  try {
    const clientResult = await pool.query<{ id: number }>(
      `UPDATE clients
          SET push_subscription = NULL
        WHERE push_subscription IS NOT NULL
          AND id NOT IN (
                SELECT DISTINCT user_id
                  FROM notifications
                 WHERE user_role = 'client'
                   AND delivered_at > NOW() - ($1 * INTERVAL '1 day')
              )
       RETURNING id`,
      [STALE_DAYS]
    );

    const driverResult = await pool.query<{ id: number }>(
      `UPDATE drivers
          SET push_subscription = NULL
        WHERE push_subscription IS NOT NULL
          AND id NOT IN (
                SELECT DISTINCT user_id
                  FROM notifications
                 WHERE user_role = 'driver'
                   AND delivered_at > NOW() - ($1 * INTERVAL '1 day')
              )
       RETURNING id`,
      [STALE_DAYS]
    );

    const adminResult = await pool.query<{ id: number }>(
      `UPDATE admins
          SET push_subscription = NULL
        WHERE push_subscription IS NOT NULL
          AND id NOT IN (
                SELECT DISTINCT user_id
                  FROM notifications
                 WHERE user_role = 'admin'
                   AND delivered_at > NOW() - ($1 * INTERVAL '1 day')
              )
       RETURNING id`,
      [STALE_DAYS]
    );

    const total =
      (clientResult.rowCount ?? 0) +
      (driverResult.rowCount ?? 0) +
      (adminResult.rowCount ?? 0);

    if (total > 0) {
      logger.info(
        {
          clients: clientResult.rowCount ?? 0,
          drivers: driverResult.rowCount ?? 0,
          admins: adminResult.rowCount ?? 0,
        },
        `push cleanup: cleared ${total} stale subscription(s)`
      );
    } else {
      logger.info("push cleanup: no stale subscriptions found");
    }
  } catch (err) {
    logger.error({ err }, "push cleanup: failed");
  }
}

// ─── Job 2: Expired user_tokens cleanup ──────────────────────────────────────

async function runTokenCleanup(): Promise<void> {
  logger.info("token cleanup: removing expired auth tokens");
  try {
    const result = await pool.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM user_tokens
          WHERE expires_at < NOW()
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM deleted`
    );
    const deleted = result.rows[0]?.count ?? "0";
    if (parseInt(deleted) > 0) {
      logger.info({ deleted }, "token cleanup: removed expired tokens");
    } else {
      logger.info("token cleanup: no expired tokens found");
    }
  } catch (err) {
    logger.error({ err }, "token cleanup: failed");
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export function startPushCleanupJob(): void {
  const timer = setTimeout(() => {
    void runPushCleanup();
    void runTokenCleanup();
    setInterval(() => {
      void runPushCleanup();
      void runTokenCleanup();
    }, INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  if (timer.unref) timer.unref();
}
