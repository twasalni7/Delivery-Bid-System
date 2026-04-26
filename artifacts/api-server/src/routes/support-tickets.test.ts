import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      clientsTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    supportTicketsTable: {},
    clientsTable: {},
    driversTable: {},
    eq: vi.fn(),
    desc: vi.fn(),
  };
});

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
  notifyAllAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@workspace/db";
import supportTicketsRouter from "../routes/support-tickets";

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue(result);
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
  app.use("/support-tickets", supportTicketsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /support-tickets (client submits ticket)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/support-tickets").send({ type: "تأخير", message: "Driver was late" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as admin", async () => {
    const app = createApp({ id: 3, role: "admin", name: "Admin" });
    const res = await request(app).post("/support-tickets").send({ type: "تأخير", message: "test" });
    expect(res.status).toBe(403);
  });

  it("creates ticket successfully as driver", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: 2, clientId: null, driverId: 2, requestId: null,
      type: "تأخير", message: "Client no-show", status: "OPEN",
      adminReply: null, createdAt: new Date(), updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/support-tickets")
      .send({ type: "تأخير", message: "Client no-show" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 2, type: "تأخير", status: "OPEN" });
  });

  it("returns 400 for invalid ticket type", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/support-tickets")
      .send({ type: "INVALID_TYPE", message: "test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("نوع");
  });

  it("returns 400 when message is empty", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/support-tickets")
      .send({ type: "تأخير", message: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("الرسالة");
  });

  it("returns 400 when message is missing", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/support-tickets")
      .send({ type: "دفع" });
    expect(res.status).toBe(400);
  });

  it("creates ticket successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, clientId: 1, driverId: null, requestId: null,
      type: "تأخير", message: "Driver was late", status: "OPEN",
      adminReply: null, createdAt: new Date(), updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/support-tickets")
      .send({ type: "تأخير", message: "Driver was late" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, type: "تأخير", status: "OPEN" });
  });

  it("creates ticket with all valid types", async () => {
    const validTypes = ["تأخير", "دفع", "إلغاء", "أخرى"];
    for (const type of validTypes) {
      const returningMock = vi.fn().mockResolvedValue([{
        id: 1, clientId: 1, driverId: null, requestId: null,
        type, message: "test", status: "OPEN",
        adminReply: null, createdAt: new Date(), updatedAt: new Date(),
      }]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

      const app = createApp({ id: 1, role: "client", name: "Ali" });
      const res = await request(app)
        .post("/support-tickets")
        .send({ type, message: "test" });
      expect(res.status).toBe(201);
    }
  });
});

describe("GET /support-tickets/my (client gets own tickets)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/support-tickets/my");
    expect(res.status).toBe(401);
  });

  it("returns client's tickets", async () => {
    const chain = makeSelectChain([
      { id: 1, clientId: 1, driverId: null, requestId: null, type: "تأخير", message: "Late", status: "OPEN", adminReply: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/support-tickets/my");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, type: "تأخير" });
  });
});

describe("GET /support-tickets (admin gets all tickets)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/support-tickets");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/support-tickets");
    expect(res.status).toBe(403);
  });

  it("returns all tickets for admin", async () => {
    const chain = makeSelectChain([
      { id: 1, clientId: 1, driverId: null, requestId: null, type: "دفع", message: "Payment issue", status: "OPEN", adminReply: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, name: "Ali" });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/support-tickets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("PATCH /support-tickets/:id (admin replies)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/support-tickets/1").send({ adminReply: "Noted" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/support-tickets/1").send({ adminReply: "Noted" });
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/support-tickets/abc").send({ adminReply: "Noted" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/support-tickets/1")
      .send({ status: "INVALID_STATUS" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when ticket not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/support-tickets/999")
      .send({ adminReply: "Noted" });
    expect(res.status).toBe(404);
  });

  it("updates ticket with reply successfully", async () => {
    const updated = {
      id: 1, clientId: 1, driverId: null, requestId: null,
      type: "تأخير", message: "Late", status: "IN_PROGRESS",
      adminReply: "We are looking into it", createdAt: new Date(), updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/support-tickets/1")
      .send({ adminReply: "We are looking into it", status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, adminReply: "We are looking into it" });
  });
});

describe("DELETE /support-tickets/:id (admin deletes)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).delete("/support-tickets/1");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).delete("/support-tickets/1");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/support-tickets/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when ticket not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/support-tickets/999");
    expect(res.status).toBe(404);
  });

  it("deletes ticket successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/support-tickets/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
