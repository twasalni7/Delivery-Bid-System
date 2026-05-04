/**
 * Push subscription cleanup job
 *
 * Runs once per day (starting 5 minutes after server boot).
 * Clears push_subscription for users who have not had a successfully
 * delivered push notification in the last STALE_DAYS days.
 *
 * This supplements the organic cleanup that fires whenever a push
 * attempt receives a 404/410 response.
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";

const STALE_DAYS = 30;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000;  // 5 minutes after boot

async function runCleanup(): Promise<void> {
  logger.info("push cleanup: starting stale subscription cleanup");

  try {
    // Clear push_subscription for clients whose last successfully delivered
    // notification is older than STALE_DAYS, or who have never received one
    // but have a subscription stored.
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

export function startPushCleanupJob(): void {
  // Delay first run so the server has time to finish startup
  const timer = setTimeout(() => {
    void runCleanup();
    setInterval(() => void runCleanup(), INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  // Allow the process to exit even if the timer is pending
  if (timer.unref) timer.unref();
}
