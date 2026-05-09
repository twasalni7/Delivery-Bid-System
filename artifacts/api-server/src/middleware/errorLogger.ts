/**
 * errorLogger.ts — توصّلني
 *
 * Global Express error middleware.
 * Captures EVERY unhandled error from any route and persists it to
 * the system_errors table with full context.
 *
 * Features:
 *  - Flood protection: same error type+message within 1 hour → increments count
 *  - Captures: message, stack, route, method, ip, user_agent, userId, role, env
 *  - Never throws — always calls next(err) so the app keeps running
 *  - Fire-and-forget DB write (non-blocking)
 */

import type { ErrorRequestHandler } from "express";
import { db } from "@workspace/db";
import { systemErrorsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Flood guard: same error type+message deduped within this window ─────────
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ─── In-memory rate limiter per error fingerprint (extra safety) ─────────────
// Prevents a DB write storm if the same error fires thousands of times/second
// before the DB dedup kicks in.
const IN_MEMORY_COOLDOWN_MS = 10_000; // 10 seconds
const inMemorySeen = new Map<string, number>();

function getFingerprint(errorType: string, message: string): string {
  // Normalize message to remove memory addresses / line numbers that change
  const normalized = message.replace(/0x[0-9a-f]+/gi, "0x?").substring(0, 200);
  return `${errorType}::${normalized}`;
}

function isThrottledInMemory(fingerprint: string): boolean {
  const last = inMemorySeen.get(fingerprint);
  const now = Date.now();
  if (last && now - last < IN_MEMORY_COOLDOWN_MS) return true;
  inMemorySeen.set(fingerprint, now);
  // Prevent unbounded growth
  if (inMemorySeen.size > 500) {
    const oldest = inMemorySeen.keys().next().value;
    if (oldest) inMemorySeen.delete(oldest);
  }
  return false;
}

async function persistError(params: {
  errorType: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  userId?: number;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  severity: string;
  environment: string;
}): Promise<void> {
  try {
    const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS);

    // Check for existing unresolved duplicate within the dedup window
    const existing = await db
      .select({ id: systemErrorsTable.id, count: systemErrorsTable.count })
      .from(systemErrorsTable)
      .where(
        and(
          eq(systemErrorsTable.errorType, params.errorType),
          eq(systemErrorsTable.message, params.message.substring(0, 500)),
          eq(systemErrorsTable.resolved, false),
          gte(systemErrorsTable.createdAt, dedupSince),
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // Increment counter + update last_seen_at
      await db
        .update(systemErrorsTable)
        .set({
          count: (existing[0].count ?? 1) + 1,
          updatedAt: new Date(),
          // @ts-expect-error — column added via migration, Drizzle schema updated
          lastSeenAt: new Date(),
        })
        .where(eq(systemErrorsTable.id, existing[0].id));
    } else {
      // Insert new error record
      await db.insert(systemErrorsTable).values({
        errorType: params.errorType,
        message: params.message.substring(0, 500),
        stack: params.stack?.substring(0, 3000),
        // @ts-expect-error — columns added via migration
        route: params.route?.substring(0, 200),
        method: params.method,
        userId: params.userId,
        userRole: params.userRole,
        ip: params.ip?.substring(0, 45),
        userAgent: params.userAgent?.substring(0, 300),
        severity: params.severity,
        environment: params.environment,
        lastSeenAt: new Date(),
        count: 1,
        resolved: false,
      });
    }
  } catch (dbErr) {
    // Never let error logging crash the app
    logger.warn({ dbErr }, "errorLogger: failed to persist to system_errors");
  }
}

// ─── Classify severity based on HTTP status ──────────────────────────────────
function classifySeverity(err: Error & { status?: number; statusCode?: number }): string {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  return "info";
}

// ─── Main Express error middleware ───────────────────────────────────────────
export const errorLogger: ErrorRequestHandler = (err, req, _res, next) => {
  const error = err as Error & { status?: number; statusCode?: number; code?: string };

  const errorType = error.code ?? error.constructor?.name ?? "UnknownError";
  const message = error.message ?? String(error);
  const fingerprint = getFingerprint(errorType, message);
  const severity = classifySeverity(error);
  const environment = process.env["NODE_ENV"] ?? "production";

  // Log to stdout always
  logger.error({ err, method: req.method, path: req.path }, "Request error");

  // In-memory throttle before DB write
  if (!isThrottledInMemory(fingerprint)) {
    const user = req.tokenUser ?? req.session?.user;

    // Fire-and-forget — never awaited so it can't block the response
    persistError({
      errorType,
      message,
      stack: error.stack,
      route: req.path,
      method: req.method,
      userId: user?.id,
      userRole: user?.role,
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip,
      userAgent: req.headers["user-agent"],
      severity,
      environment,
    }).catch(() => {/* already handled inside persistError */});
  }

  next(err);
};

// ─── Utility: persist a non-request error (background jobs, process events) ──
export async function logSystemError(params: {
  errorType: string;
  message: string;
  stack?: string;
  context?: string;
  severity?: "info" | "warning" | "error" | "critical";
}): Promise<void> {
  const fingerprint = getFingerprint(params.errorType, params.message);
  if (isThrottledInMemory(fingerprint)) return;

  await persistError({
    errorType: params.errorType,
    message: params.message,
    stack: params.stack,
    route: params.context,
    severity: params.severity ?? "error",
    environment: process.env["NODE_ENV"] ?? "production",
  });
}
