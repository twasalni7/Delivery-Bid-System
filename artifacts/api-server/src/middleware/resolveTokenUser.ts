import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { userTokensTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";

/**
 * Middleware that runs after the session middleware.
 * If the session already has a user, it is left unchanged.
 * Otherwise, if an `Authorization: Bearer <token>` header is present,
 * the token is validated against the `user_tokens` table and, if valid,
 * `req.tokenUser` is populated.
 *
 * Downstream middleware (requireAuth) reads `req.session.user ?? req.tokenUser`,
 * so all route handlers work transparently whether the client authenticated via
 * a session cookie or a bearer token.
 *
 * NOTE: We deliberately do NOT write to `req.session` here.  Writing to the
 * session on every token-authenticated request causes connect-pg-simple to
 * persist a new row to `user_sessions` for every API call, which bloats the
 * database.  Token auth is stateless on the server side.
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
      const role = record.role;
      if (role !== "client" && role !== "driver" && role !== "admin") {
        next();
        return;
      }
      // Populate req.tokenUser only — do NOT touch req.session to avoid
      // spurious session DB writes on every token-authenticated request.
      req.tokenUser = {
        id: record.userId,
        role,
        name: record.name,
      };
    }
  } catch {
    // DB error — continue without auth; the route's requireAuth will reject.
  }

  next();
}
