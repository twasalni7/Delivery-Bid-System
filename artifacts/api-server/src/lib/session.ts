import type { Request } from "express";

export interface SessionUser {
  id: number;
  role: "client" | "driver" | "admin";
  name: string;
}

/**
 * Returns the authenticated user from either the session (cookie auth) or the
 * token middleware (Bearer token auth).  Always prefer this helper over
 * accessing req.session.user directly so that token-authenticated requests are
 * handled transparently.
 */
export function getSessionUser(req: Request): SessionUser | undefined {
  return req.session.user ?? req.tokenUser;
}
