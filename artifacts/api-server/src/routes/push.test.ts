import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      pushSubscriptionsTable: { findFirst: vi.fn() },
    },
  };
  return {
    db: mockDb,
    pushSubscriptionsTable: {
      userId: "user_id",
      userRole: "user_role",
      subscriptionData: "subscription_data",
    },
    notificationsTable: {
      deliveredAt: "delivered_at",
      clickedAt: "clicked_at",
    },
    eq: vi.fn(),
    and: vi.fn(),
    isNotNull: vi.fn(),
    isNull: vi.fn(),
    count: vi.fn(() => "count"),
    sql: vi.fn(),
  };
});

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/notification-targeting", () => ({
  ensureNotificationUserExists: vi.fn().mockResolvedValue(true),
  getNotificationTargetingMetadata: vi.fn().mockResolvedValue({
    roles: [
      { value: "client", label: "عميل", count: 2 },
      { value: "driver", label: "سائق", count: 3 },
      { value: "admin", label: "مشرف", count: 1 },
    ],
    fieldsByRole: {
      client: [{ key: "name", label: "الاسم", type: "string", operators: ["eq", "contains"] }],
      driver: [{ key: "status", label: "الحالة", type: "enum", operators: ["eq"], options: ["ACTIVE"] }],
      admin: [{ key: "name", label: "الاسم", type: "string", operators: ["eq"] }],
    },
    users: [{ id: 5, role: "client", name: "Ali", subtitle: "0500000000" }],
  }),
  resolveNotificationRecipients: vi.fn().mockResolvedValue([
    { id: 5, role: "client", name: "Ali", subtitle: "0500000000" },
  ]),
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

/** A valid PushSubscriptionJSON body for testing */
const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/push/1",
  keys: { auth: "abc123", p256dh: "defgh456" },
};

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
      .send({ subscription: VALID_SUBSCRIPTION });
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

  it("returns 400 when subscription is missing keys", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://example.com", keys: {} } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when subscription is fake/test data like {test: true}", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { test: true } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("saves subscription for client (session auth)", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/subscribe").send({ subscription: VALID_SUBSCRIPTION });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for client (Bearer token auth via tokenUser)", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ tokenUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/subscribe").send({ subscription: VALID_SUBSCRIPTION });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for driver", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/2", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for driver (Bearer token auth via tokenUser)", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ tokenUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/2", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves subscription for admin", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 3, role: "admin", name: "Admin" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { endpoint: "https://fcm.googleapis.com/push/3", keys: { auth: "abc", p256dh: "def" } } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 when database insert fails", async () => {
    const valuesMock = vi.fn().mockImplementation(() => {
      throw new Error("DB error");
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/subscribe").send({ subscription: VALID_SUBSCRIPTION });
    expect(res.status).toBe(500);
  });

  it("normalizes flat body format (body IS the subscription, no wrapper)", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    // Send the subscription object directly without wrapping in { subscription: ... }
    const res = await request(app).post("/push/subscribe").send(VALID_SUBSCRIPTION);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("normalizes double-nested format { subscription: { subscription: {...} } }", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app)
      .post("/push/subscribe")
      .send({ subscription: { subscription: VALID_SUBSCRIPTION } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("normalizes top-level keys format { endpoint, p256dh, auth }", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    // Some older push providers return keys at the top level instead of nested under `keys`
    const res = await request(app).post("/push/subscribe").send({
      subscription: {
        endpoint: "https://fcm.googleapis.com/push/4",
        p256dh: "topLevelKey",
        auth: "topLevelAuth",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("saves normalised data with only endpoint+expirationTime+keys to DB", async () => {
    const onConflictMock = vi.fn().mockResolvedValue([]);
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    await request(app).post("/push/subscribe").send({
      subscription: { ...VALID_SUBSCRIPTION, expirationTime: 9999, extraField: "ignored" },
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionData: {
          endpoint: VALID_SUBSCRIPTION.endpoint,
          expirationTime: 9999,
          keys: VALID_SUBSCRIPTION.keys,
        },
      })
    );
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

    // First three calls: count queries (clients, drivers, admins) - each resolves with a count
    // Fourth call: endpoint listing - resolves with empty array
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) })
      .mockReturnValue({ from: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) });

    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).get("/push/debug");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("vapidConfigured", true);
    expect(res.body).toHaveProperty("subscriptions");
  });
});

describe("GET /push/targeting-metadata", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/push/targeting-metadata");
    expect(res.status).toBe(401);
  });

  it("returns targeting metadata for admin", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app).get("/push/targeting-metadata");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roles");
    expect(res.body).toHaveProperty("users");
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
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ sessionUser: { id: 1, role: "client", name: "Ali" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("removes subscription for driver", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ sessionUser: { id: 2, role: "driver", name: "Khaled" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("removes subscription for admin", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ sessionUser: { id: 3, role: "admin", name: "Admin" } });
    const res = await request(app).post("/push/unsubscribe");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 when database delete fails", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("DB error");
    });

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
    expect(res.body).toHaveProperty("recipientCount", 1);
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

  it("dispatches notification to a custom filtered segment", async () => {
    const app = createApp({ sessionUser: { id: 1, role: "admin", name: "Admin" } });
    const res = await request(app)
      .post("/push/send")
      .send({
        title: "Filtered",
        message: "Hello",
        audience: {
          mode: "filters",
          segments: [
            { role: "driver", filters: [{ field: "status", operator: "eq", value: "ACTIVE" }] },
          ],
        },
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("recipientCount", 1);
  });
});
