import type { Request } from "express";

export interface SessionUser {
  id: number;
  role: "client" | "driver" | "admin";
  name: string;
}

export function getSessionUser(req: Request): SessionUser | undefined {
  return req.session.user;
}
