import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      driversTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    driversTable: {},
    transactionsTable: {},
    requestsTable: {},
    eq: vi.fn(),
    ne: vi.fn(),
  };
});

vi.mock("@workspace/api-zod", () => ({
  AddDriverBalanceBody: {
    safeParse: vi.fn(),
  },
}));

import { db } from "@workspace/db";
import { AddDriverBalanceBody } from "@workspace/api-zod";
import driversRouter from "../routes/drivers";

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
  app.use("/drivers", driversRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /drivers", () => {
  it("returns list of active drivers", async () => {
    const chain = makeSelectChain([
      { id: 1, name: "Khaled", balance: 100, carType: "Sedan", nationality: "SA", status: "ACTIVE", warningCount: 0, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, name: "Khaled" });
  });
});

describe("GET /drivers/me", () => {
  it("returns 401 when not authenticated as driver", async () => {
    const app = createApp(); // no session user
    const res = await request(app).get("/drivers/me");
    expect(res.status).toBe(401);
  });

  it("returns driver profile when authenticated", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      name: "Khaled",
      mobile: "0501234567",
      balance: 200,
      carType: "SUV",
      nationality: "SA",
      age: 30,
      nationalId: "1234567890",
      status: "ACTIVE",
      warningCount: 0,
      createdAt: new Date(),
    });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/drivers/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, name: "Khaled", mobile: "0501234567" });
  });

  it("returns 404 when driver not found in DB", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 999, role: "driver", name: "Ghost" });
    const res = await request(app).get("/drivers/me");
    expect(res.status).toBe(404);
  });
});

describe("GET /drivers/me/requests", () => {
  it("returns 401 when not a driver", async () => {
    const app = createApp();
    const res = await request(app).get("/drivers/me/requests");
    expect(res.status).toBe(401);
  });

  it("returns list of assigned requests for driver", async () => {
    const chain = makeSelectChain([
      {
        id: 10, clientId: 1, homeLocation: "Riyadh", workLocation: "KFUPM",
        numberOfPeople: 1, workingDaysPerWeek: 5, morningTime: "07:00", eveningTime: "17:00",
        status: "ACTIVE", selectedDriverId: 2, phone: "0501111111", createdAt: new Date(),
      },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/drivers/me/requests");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 10 });
  });
});

describe("GET /drivers/:id", () => {
  it("returns 400 for invalid id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers/999");
    expect(res.status).toBe(404);
  });

  it("returns driver data for valid id", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 3,
      name: "Fahad",
      balance: 150,
      carType: "Van",
      nationality: "EG",
      status: "ACTIVE",
      warningCount: 1,
      createdAt: new Date(),
    });
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers/3");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, name: "Fahad" });
  });
});

describe("PATCH /drivers/:id/balance", () => {
  it("returns 403 when not admin", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .patch("/drivers/1/balance")
      .send({ amount: 100 });
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/drivers/1/balance")
      .send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    (AddDriverBalanceBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { amount: 100 },
    });
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/drivers/abc/balance")
      .send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body validation fails", async () => {
    (AddDriverBalanceBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: false,
    });
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/drivers/1/balance")
      .send({ amount: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (AddDriverBalanceBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { amount: 100 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/drivers/999/balance")
      .send({ amount: 100 });
    expect(res.status).toBe(404);
  });

  it("updates balance successfully", async () => {
    (AddDriverBalanceBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { amount: 100 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      name: "Khaled",
      balance: 50,
      carType: "Sedan",
      nationality: "SA",
      status: "ACTIVE",
      createdAt: new Date(),
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, name: "Khaled", balance: 150, carType: "Sedan", nationality: "SA", status: "ACTIVE", createdAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const valuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app)
      .patch("/drivers/1/balance")
      .send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, balance: 150 });
  });
});

describe("GET /drivers/:id/transactions", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers/abc/transactions");
    expect(res.status).toBe(400);
  });

  it("returns transactions list for a driver", async () => {
    const chain = makeSelectChain([
      { id: 1, driverId: 2, amount: 100, type: "CREDIT", createdAt: new Date() },
      { id: 2, driverId: 2, amount: -50, type: "fee", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/drivers/2/transactions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });
});
