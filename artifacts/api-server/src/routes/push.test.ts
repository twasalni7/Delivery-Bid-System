import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    update: vi.fn(),
  };
  return {
    db: mockDb,
    clientsTable: { id: "id" },
    driversTable: { id: "id" },
    adminsTable: { id: "id" },
    eq: vi.fn(),
  };
});

import { db } from "@workspace/db";
import pushRouter from "../routes/push";

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
  app.use("/push", pushRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["VAPID_PUBLIC_KEY"];
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
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/push/subscribe").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when subscription is not an object", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/push/subscribe").send({ subscription: "invalid" });
    expect(res.status).toBe(400);
  });

  it("saves subscription for client", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
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

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
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

    const app = createApp({ id: 3, role: "admin", name: "Admin" });
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

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://example.com", keys: {} } });
    expect(res.status).toBe(500);
  });
});
