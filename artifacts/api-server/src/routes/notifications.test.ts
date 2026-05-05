import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  };
    return {
      db: mockDb,
      notificationsTable: {
        userId: "userId",
        userRole: "userRole",
        isRead: "isRead",
        readAt: "readAt",
        createdAt: "createdAt",
        id: "id",
        clickedAt: "clickedAt",
        interactedAt: "interactedAt",
        interactionSource: "interactionSource",
        interactionType: "interactionType",
      },
    eq: vi.fn(),
    and: vi.fn(),
    desc: vi.fn(),
    count: vi.fn().mockReturnValue("count_expr"),
  };
});

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { db } from "@workspace/db";
import notificationsRouter from "../routes/notifications";

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeSelectCountChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([]);
  return chain;
}

function createApp(sessionUser?: unknown) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = {
      user: sessionUser ?? undefined,
      destroy: (cb: () => void) => cb(),
    };
    next();
  });
  app.use("/notifications", notificationsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /notifications", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/notifications");
    expect(res.status).toBe(401);
  });

  it("returns notifications list for authenticated user", async () => {
    const chain = makeSelectChain([
      { id: 1, userId: 1, userRole: "client", message: "Hello", isRead: false, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/notifications");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns empty list when no notifications", async () => {
    const chain = makeSelectChain([]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/notifications");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockRejectedValue(new Error("DB error"));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/notifications");
    expect(res.status).toBe(500);
  });
});

describe("GET /notifications/unread-count", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/notifications/unread-count");
    expect(res.status).toBe(401);
  });

  it("returns unread count for authenticated user", async () => {
    const chain = makeSelectCountChain([{ count: "3" }]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/notifications/unread-count");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 3 });
  });

  it("returns 0 when no unread notifications", async () => {
    const chain = makeSelectCountChain([{ count: "0" }]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/notifications/unread-count");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 0 });
  });

  it("returns 500 on database error", async () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockRejectedValue(new Error("DB error"));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/notifications/unread-count");
    expect(res.status).toBe(500);
  });
});

describe("PATCH /notifications/mark-all-read", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/notifications/mark-all-read");
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read", async () => {
    const chain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/notifications/mark-all-read");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 on database error", async () => {
    const chain: Record<string, unknown> = {};
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockRejectedValue(new Error("DB error"));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/notifications/mark-all-read");
    expect(res.status).toBe(500);
  });
});

describe("PATCH /notifications/:id/read", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/notifications/1/read");
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/notifications/abc/read");
    expect(res.status).toBe(400);
  });

  it("marks a specific notification as read", async () => {
    const chain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/notifications/5/read");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 on database error", async () => {
    const chain: Record<string, unknown> = {};
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockRejectedValue(new Error("DB error"));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/notifications/5/read");
    expect(res.status).toBe(500);
  });
});

describe("POST /notifications/:id/interact", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/notifications/1/interact");
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/notifications/abc/interact");
    expect(res.status).toBe(400);
  });

  it("tracks interaction for a notification", async () => {
    const chain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/notifications/7/interact").send({ source: "push", action: "action" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
