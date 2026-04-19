import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getSessionUser } from "../lib/session";

function makeReq(user?: unknown): Request {
  return { session: { user } } as unknown as Request;
}

describe("getSessionUser", () => {
  it("returns the session user when present", () => {
    const user = { id: 1, role: "client" as const, name: "Ali" };
    const req = makeReq(user);
    expect(getSessionUser(req)).toEqual(user);
  });

  it("returns undefined when no user in session", () => {
    const req = makeReq(undefined);
    expect(getSessionUser(req)).toBeUndefined();
  });

  it("returns undefined when session is empty", () => {
    const req = { session: {} } as unknown as Request;
    expect(getSessionUser(req)).toBeUndefined();
  });
});
