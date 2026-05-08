import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      walletTransactionsTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    walletTransactionsTable: {
      driverId: "driverId",
      createdAt: "createdAt",
      id: "id",
      status: "status",
    },
    driversTable: { id: "id", name: "name" },
    transactionsTable: { driverId: "driverId", amount: "amount", type: "type" },
    eq: vi.fn(),
    desc: vi.fn(),
    sql: vi.fn(),
  };
});

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
  notifyAllAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@workspace/db";
import walletTransactionsRouter from "../routes/wallet-transactions";

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue(result);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
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
  app.use("/wallet-transactions", walletTransactionsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /wallet-transactions", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/wallet-transactions");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/wallet-transactions");
    expect(res.status).toBe(403);
  });

  it("returns driver's own transactions", async () => {
    const chain = makeSelectChain([
      { id: 1, driverId: 2, amount: "100", status: "pending", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/wallet-transactions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns all transactions with driver names for admin", async () => {
    const chain = makeSelectChain([
      { id: 1, driverId: 2, driverName: "Khaled", amount: "100", status: "pending", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/wallet-transactions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /wallet-transactions (driver submits top-up)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/wallet-transactions").send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/wallet-transactions").send({ amount: 100 });
    expect(res.status).toBe(403);
  });

  it("returns 400 when amount is missing", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is zero", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is negative", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({ amount: -50 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is a string", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({ amount: "100" });
    expect(res.status).toBe(400);
  });

  it("creates top-up request successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: 5, driverId: 2, amount: "100", receiptUrl: null, status: "pending", createdAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({ amount: 100 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 5, status: "pending" });
  });

  it("creates top-up request with receiptUrl", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: 6, driverId: 2, amount: "200", receiptUrl: "https://example.com/receipt.jpg", status: "pending", createdAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions").send({ amount: 200, receiptUrl: "https://example.com/receipt.jpg" });
    expect(res.status).toBe(201);
  });
});

describe("POST /wallet-transactions/:id/approve (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as driver", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/abc/approve");
    expect(res.status).toBe(400);
  });

  it("returns 404 when transaction not found", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/999/approve");
    expect(res.status).toBe(404);
  });

  it("returns 400 when transaction is not pending", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "100", status: "approved",
    });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("انتظار");
  });

  it("returns 404 when driver not found", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 999, amount: "100", status: "pending",
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(404);
  });

  it("returns 400 when transaction amount is invalid", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "invalid", status: "pending", intId: 1,
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 50,
    });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(400);
  });

  it("approves transaction and credits driver balance", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "100", status: "pending",
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 50,
    });

    const updateWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const updateReturningMock = vi.fn().mockResolvedValue([{
      id: 1, driverId: 2, amount: "100", status: "approved", updatedAt: new Date(),
    }]);
    const updateWhereMock2 = vi.fn().mockReturnValue({ returning: updateReturningMock });
    const updateSetMock2 = vi.fn().mockReturnValue({ where: updateWhereMock2 });

    let callCount = 0;
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { set: updateSetMock };
      return { set: updateSetMock2 };
    });
    const insertValuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValuesMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/approve");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("transaction");

    // Ensure the ledger entry uses type "credit" (not "topup") to satisfy the
    // transactions_type_check DB constraint.
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "credit" })
    );
  });
});

describe("POST /wallet-transactions/:id/reject (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/wallet-transactions/1/reject");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/wallet-transactions/1/reject");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/abc/reject");
    expect(res.status).toBe(400);
  });

  it("returns 404 when transaction not found", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/999/reject");
    expect(res.status).toBe(404);
  });

  it("returns 400 when transaction is not pending", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "100", status: "rejected",
    });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/reject");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("انتظار");
  });

  it("rejects transaction successfully", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "100", status: "pending",
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, driverId: 2, amount: "100", status: "rejected", notes: "Invalid receipt", updatedAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/reject").send({ notes: "Invalid receipt" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("transaction");
  });

  it("rejects transaction without notes", async () => {
    (db.query.walletTransactionsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, amount: "100", status: "pending",
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, driverId: 2, amount: "100", status: "rejected", notes: null, updatedAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/wallet-transactions/1/reject").send({});
    expect(res.status).toBe(200);
  });
});
