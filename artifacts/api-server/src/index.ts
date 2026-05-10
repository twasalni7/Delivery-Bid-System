/**
 * index.ts — توصّلني (updated)
 *
 * Changes from original:
 *  - Added process.on("uncaughtException") → logs to system_errors + exits
 *  - Added process.on("unhandledRejection") → logs to system_errors (no exit)
 *  - Both also captured by Sentry automatically via instrument.ts
 */

import "./instrument";
import app from "./app";
import { logger } from "./lib/logger";
import { logSystemError } from "./middleware/errorLogger";
import { startPushCleanupJob } from "./lib/cleanup";
import { isOneSignalConfigured } from "./lib/onesignal";
import { startRequestStatusSyncJob } from "./lib/request-status-sync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── VAPID check ───────────────────────────────────────────────────────────
const vapidPublicKey = process.env["VAPID_PUBLIC_KEY"];
const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"];
if (isOneSignalConfigured()) {
  logger.info("OneSignal is configured — external push delivery uses OneSignal");
} else if (!vapidPublicKey || !vapidPrivateKey) {
  logger.warn(
    "VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY are not set. " +
    "External push delivery will be skipped unless OneSignal is configured. " +
    "Run: pnpm --filter @workspace/scripts run generate-vapid"
  );
} else {
  logger.info(
    {
      "vapid.public.prefix": vapidPublicKey.substring(0, 20) + "...",
      "vapid.subject": process.env["VAPID_SUBJECT"] || "mailto:admin@twasalni.app",
    },
    "VAPID keys loaded — web push notifications are enabled"
  );
}

// ─── Process-level error handlers ─────────────────────────────────────────
// These catch errors that escape Express (background jobs, startup failures)

process.on("uncaughtException", async (err: Error) => {
  logger.fatal({ err }, "uncaughtException — process will exit");
  try {
    await logSystemError({
      errorType: "UncaughtException",
      message: err.message,
      stack: err.stack,
      context: "process.uncaughtException",
      severity: "critical",
    });
  } catch {
    // If DB is down we still need to exit
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err }, "unhandledRejection — not exiting");
  logSystemError({
    errorType: "UnhandledRejection",
    message: err.message,
    stack: err.stack,
    context: "process.unhandledRejection",
    severity: "error",
  }).catch(() => {});
});

// ─── Start server ─────────────────────────────────────────────────────────
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startPushCleanupJob();
  startRequestStatusSyncJob();
});
