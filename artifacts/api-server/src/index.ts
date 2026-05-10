import "./instrument";
import app from "./app";
import { logger } from "./lib/logger";
import { startPushCleanupJob } from "./lib/cleanup";
import { isOneSignalConfigured } from "./lib/onesignal";
import { startRequestStatusSyncJob } from "./lib/request-status-sync";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── VAPID check ───────────────────────────────────────────────────────────
// Without these keys the server cannot send web push notifications.
// Generate a pair with: pnpm --filter @workspace/scripts run generate-vapid
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
      "vapid.public.prefix": vapidPublicKey.substring(0, Math.min(20, vapidPublicKey.length)) + "...",
      "vapid.subject": process.env["VAPID_SUBJECT"] || process.env["VAPID_EMAIL"] || "mailto:admin@twasalni.app",
    },
    "VAPID keys loaded — web push notifications are enabled"
  );
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startPushCleanupJob();
  startRequestStatusSyncJob();
});
