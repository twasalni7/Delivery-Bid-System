import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { userTokensTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";

/**
 * Middleware that runs after the session middleware.
 * If the session already has a user, it is left unchanged.
 * Otherwise, if an `Authorization: Bearer <token>` header is present,
 * the token is validated against the `user_tokens` table and, if valid,
 * `req.session.user` is populated so that all downstream middleware and
 * route handlers can treat it as a normal authenticated session.
 */
export async function resolveTokenUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Session already has a user — nothing to do.
  if (req.session.user) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const record = await db.query.userTokensTable.findFirst({
      where: and(
        eq(userTokensTable.token, token),
        gte(userTokensTable.expiresAt, new Date()),
      ),
    });

    if (record) {
      req.session.user = {
        id: record.userId,
        role: record.role as "client" | "driver" | "admin",
        name: record.name,
      };
    }
  } catch {
    // DB error — continue without auth; the route's requireAuth will reject.
  }

  next();
}
