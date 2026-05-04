import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    update: vi.fn(),
    select: vi.fn(),
    query: {
      clientsTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
      adminsTable: { findFirst: vi.fn() },
    },
  };
  return {
    db: mockDb,
    clientsTable: { id: "id", pushSubscription: "push_subscription" },
    driversTable: { id: "id", pushSubscription: "push_subscription", status: "status" },
    adminsTable: { id: "id", pushSubscription: "push_subscription" },
    eq: vi.fn(),
    isNotNull: vi.fn(),
    count: vi.fn(() => "count"),
  };
});

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
  notifyAllDrivers: vi.fn().mockResolvedValue(undefined),
  notifyAllAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@workspace/db";
import pushRouter from "../routes/push";

/** Helper: create an app with optional session user or tokenUser (Bearer auth) */
function createApp(opts?: { sessionUser?: unknown; tokenUser?: unknown }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = {
      user: opts?.sessionUser ?? undefined,
      destroy: (cb: () => void) => cb(),
    };
    if (opts?.tokenUser) {
      req.tokenUser = opts.tokenUser;
    }
    next();
  });
  app.use("/push", pushRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["VAPID_PUBLIC_KEY"];
  delete process.env["VAPID_PRIVATE_KEY"];
});

describe("GET /push/vapid-public-key", () => {
  it("returns 503 when VAPID_PUBLIC_KEY is not configured", async () => {
    const app = createApp();
    const res = await request(app).get("/push/vapid-public-key");
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("error");
  });

  it("returns VAPID public key when configured", async () => {
    process.env["VAPID_PUBLIC_KEY"] = "test-vapid-key";
    const app = createApp();
    const res = await request(app).get("/push/vapid-public-key");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ publicKey: "test-vapid-key" });
  });
});

describe("POST /push/subscribe", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://example.com", keys: {} } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when subscription is missing", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/subscribe").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when subscription is not an object", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/subscribe").send({ subscription: "invalid" });
    expect(res.status).toBe(400);
  });

  it("saves subscription for client (session auth)", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/1", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for client (Bearer token auth via tokenUser)", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    // No session user — only tokenUser (simulates Bearer token flow)
    const app = createApp({ tokenUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/1", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for driver", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/2", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for driver (Bearer token auth via tokenUser)", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ tokenUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/2", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for admin", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 3, role: "admin", name: "Admin" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/3", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 when database update fails", async () => {
    const setMock = vi.fn().mockImplementation(() => {
      throw new Error("DB error");
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://example.com", keys: {} } });
    expect(res.status).toBe(500);
  });
});

describe("GET /push/debug", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/push/debug");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).get("/push/debug");
    expect(res.status).toBe(403);
  });

  it("returns debug stats for admin with VAPID configured", async () => {
    process.env["VAPID_PUBLIC_KEY"] = "test-key";
    process.env["VAPID_PRIVATE_KEY"] = "test-priv";

    const selectChain = { from: vi.fn() };
    selectChain.from.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });
    // First three calls: count queries (clients, drivers, admins)
    // Then three calls: endpoint listing
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) })
      .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) });

    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).get("/push/debug");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("vapidConfigured", true);
    expect(res.body).toHaveProperty("subscriptions");
  });
});

describe("POST /push/unsubscribe", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(401);
  });

  it("removes subscription for client", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("removes subscription for driver", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("removes subscription for admin", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 3, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 when database update fails", async () => {
    const setMock = vi.fn().mockImplementation(() => {
      throw new Error("DB error");
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(500);
  });
});

describe("POST /push/send", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/push/send").send({ target: "all_drivers", title: "t", message: "m" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as non-admin", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/send").send({ target: "all_drivers", title: "t", message: "m" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when title or message is missing", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/send").send({ target: "all_drivers" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid target", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/send").send({ target: "invalid", title: "t", message: "m" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when target=user but userId/userRole missing", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/send").send({ target: "user", title: "t", message: "m" });
    expect(res.status).toBe(400);
  });

  it("dispatches notification to all_drivers", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/send").send({ target: "all_drivers", title: "Test", message: "Hello" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("dispatches notification to all_admins", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/send").send({ target: "all_admins", title: "Test", message: "Hello" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("dispatches notification to a specific user", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app)
      .post("/push/send")
      .send({ target: "user", userId: 5, userRole: "client", title: "Test", message: "Hello" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
