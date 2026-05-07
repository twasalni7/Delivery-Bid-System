import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/healthz", async (_req: Request, res: Response) => {
  let database = "up";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "down";
  }

  const checks = {
    api: "up",
    database,
    sessionSecret:
      process.env["SESSION_SECRET"] || process.env["NODE_ENV"] !== "production"
        ? "up"
        : "down",
    push:
      process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]
        ? "up"
        : "degraded",
  } as const;

  const isHealthy =
    checks.api === "up" &&
    checks.database === "up" &&
    checks.sessionSecret === "up";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "error",
    checks,
    timestamp: new Date().toISOString(),
  });
});

router.get("/readyz", async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    res.status(503).json({
      status: "not_ready",
      reason: "database_unreachable",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (process.env["NODE_ENV"] === "production" && !process.env["SESSION_SECRET"]) {
    res.status(503).json({
      status: "not_ready",
      reason: "missing_session_secret",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({ status: "ready", timestamp: new Date().toISOString() });
});

export default router;
