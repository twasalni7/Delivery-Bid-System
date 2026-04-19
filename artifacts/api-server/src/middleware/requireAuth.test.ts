import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";

function makeReqResNext(sessionUser?: unknown) {
  const req = { session: { user: sessionUser } } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next };
}

describe("requireAuth middleware", () => {
  describe("no role restriction", () => {
    it("calls next() when user is authenticated", () => {
      const { req, res, next } = makeReqResNext({ id: 1, role: "client", name: "Ahmed" });
      requireAuth()(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 401 when no user in session", () => {
      const { req, res, next } = makeReqResNext(undefined);
      requireAuth()(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("role restriction", () => {
    it("calls next() when user role matches", () => {
      const { req, res, next } = makeReqResNext({ id: 2, role: "driver", name: "Khaled" });
      requireAuth("driver")(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("returns 403 when role does not match", () => {
      const { req, res, next } = makeReqResNext({ id: 2, role: "driver", name: "Khaled" });
      requireAuth("admin")(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when no session and role is specified", () => {
      const { req, res, next } = makeReqResNext(undefined);
      requireAuth("client")(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows admin when role is admin", () => {
      const { req, res, next } = makeReqResNext({ id: 3, role: "admin", name: "Admin" });
      requireAuth("admin")(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("allows client when role is client", () => {
      const { req, res, next } = makeReqResNext({ id: 4, role: "client", name: "Sara" });
      requireAuth("client")(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
