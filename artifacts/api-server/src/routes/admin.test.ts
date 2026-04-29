import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      driversTable: { findFirst: vi.fn() },
      clientsTable: { findFirst: vi.fn() },
      adminsTable: { findFirst: vi.fn() },
      requestsTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    requestsTable: { id: "id", status: "status", createdAt: "createdAt", selectedDriverId: "selectedDriverId", clientId: "clientId", homeLocation: "homeLocation", workLocation: "workLocation" },
    driversTable: { id: "id", name: "name", status: "status", balance: "balance", loginCode: "loginCode", mobile: "mobile" },
    offersTable: { id: "id", driverId: "driverId", requestId: "requestId", status: "status", createdAt: "createdAt" },
    adminsTable: { id: "id", loginCode: "loginCode" },
    clientsTable: { id: "id", mobile: "mobile", createdAt: "createdAt", name: "name" },
    transactionsTable: { amount: "amount", type: "type" },
    walletTransactionsTable: { id: "id", driverId: "driverId", amount: "amount", status: "status", createdAt: "createdAt" },
    supportTicketsTable: { id: "id", type: "type", clientId: "clientId", driverId: "driverId", status: "status", createdAt: "createdAt" },
    eq: vi.fn(),
    ne: vi.fn(),
    and: vi.fn(),
    count: vi.fn().mockReturnValue("count_expr"),
    desc: vi.fn(),
    sql: vi.fn(),
    sum: vi.fn().mockReturnValue("sum_expr"),
    inArray: vi.fn(),
  };
});

vi.mock("../lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed.salt"),
  generateLoginCode: vi.fn().mockReturnValue("NEWCODE1"),
}));

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@workspace/api-zod", () => ({
  CreateRequestBody: {
    safeParse: vi.fn(),
  },
}));

import { db } from "@workspace/db";
import { CreateRequestBody } from "@workspace/api-zod";
import adminRouter from "../routes/admin";

/** Creates a query chain that is thenable and resolves to `data` regardless of which
 *  method is last in the chain (from, where, orderBy, groupBy, limit, etc.). */
function makeChain(data: unknown[]) {
  const chain: any = {};
  const methods = ["from", "where", "orderBy", "groupBy", "limit", "innerJoin", "leftJoin"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(data).then(resolve, reject);
  chain.catch = (reject: (e: unknown) => void) => Promise.resolve(data).catch(reject);
  return chain;
}

/** Wraps db.delete to produce a chain ending in .where().returning() */
function makeDeleteChain(result: unknown[]) {
  const returningMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  return { where: whereMock };
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
  app.use("/admin", adminRouter);
  return app;
}

const adminUser = { id: 1, role: "admin" as const, name: "Admin" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ===================== AUTH GUARD =====================

describe("Admin auth guard", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const app = createApp();
    const res = await request(app).get("/admin/stats");
    expect(res.status).toBe(401);
  });

  it("returns 403 for client users", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/admin/stats");
    expect(res.status).toBe(403);
  });

  it("returns 403 for driver users", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/admin/stats");
    expect(res.status).toBe(403);
  });
});

// ===================== GET /stats =====================

describe("GET /admin/stats", () => {
  it("returns stats object with counts", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => makeChain([{ count: "5" }]));

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalRequests");
    expect(res.body).toHaveProperty("openRequests");
    expect(res.body).toHaveProperty("totalDrivers");
    expect(res.body).toHaveProperty("totalOffers");
    expect(res.body).toHaveProperty("totalClients");
  });
});

// ===================== GET /financial =====================

describe("GET /admin/financial", () => {
  it("returns financial data", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() =>
      makeChain([{ count: "5", total: "500", id: 1, name: "Khaled", balance: 200 }])
    );

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/financial");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalDriversBalance");
    expect(res.body).toHaveProperty("acceptedContractsCount");
    expect(res.body).toHaveProperty("driverBalances");
  });
});

// ===================== GET /analytics =====================

describe("GET /admin/analytics", () => {
  it("returns analytics with default 12 month range", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => makeChain([{ count: "5", year: 2024, month: 1, id: 1, name: "Khaled", acceptedBids: "3" }]));

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/analytics");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("monthlyRequests");
    expect(res.body).toHaveProperty("topDrivers");
    expect(res.body).toHaveProperty("requestStatusSplit");
  });

  it("returns 400 for invalid date range", async () => {
    const app = createApp(adminUser);
    const res = await request(app).get("/admin/analytics?from=invalid&to=invalid");
    expect(res.status).toBe(400);
  });

  it("returns 400 when from > to", async () => {
    const app = createApp(adminUser);
    const res = await request(app).get("/admin/analytics?from=2024-12-31&to=2024-01-01");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("تاريخ");
  });

  it("returns analytics with valid date range", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => makeChain([{ count: "0", year: 2024, month: 6 }]));

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/analytics?from=2024-01-01&to=2024-12-31");
    expect(res.status).toBe(200);
  });

  it("uses 3-month filter when months=3", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => makeChain([{ count: "0", year: 2024, month: 3 }]));

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/analytics?months=3");
    expect(res.status).toBe(200);
  });
});

// ===================== GET /admin/drivers =====================

describe("GET /admin/drivers", () => {
  it("returns list of active drivers", async () => {
    const chain = makeChain([
      { id: 1, name: "Khaled", mobile: "0501234567", loginCode: "CODE1", balance: 200, carType: "Sedan", nationality: "SA", age: 30, nationalId: "1234", status: "ACTIVE", warningCount: 0, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/drivers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, name: "Khaled" });
  });

  it("returns deleted drivers when status=DELETED", async () => {
    const chain = makeChain([
      { id: 5, name: "Ahmed", mobile: "0509999999", loginCode: "CODE5", balance: 0, carType: null, nationality: null, age: null, nationalId: null, status: "DELETED", warningCount: 0, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/drivers?status=DELETED");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ===================== POST /admin/drivers =====================

describe("POST /admin/drivers", () => {
  it("returns 400 when name is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers").send({ mobile: "0501234567" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers").send({ name: "Khaled" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is already registered", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, mobile: "0501234567" });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers").send({ name: "Khaled", mobile: "0501234567" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مسجّل");
  });

  it("creates driver successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // mobile check
      .mockResolvedValueOnce(null); // loginCode uniqueness check

    const returningMock = vi.fn().mockResolvedValue([{
      id: 10, name: "Khaled", mobile: "0501234567", loginCode: "NEWCODE1",
      balance: 0, carType: "Sedan", nationality: "SA", age: 28, nationalId: "1234",
      status: "ACTIVE", warningCount: 0, createdAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers").send({
      name: "Khaled", mobile: "0501234567", carType: "Sedan", nationality: "SA", age: "28", nationalId: "1234",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 10, name: "Khaled", loginCode: "NEWCODE1" });
  });
});

// ===================== POST /admin/drivers/import =====================

describe("POST /admin/drivers/import", () => {
  it("returns 400 when drivers array is empty", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({ drivers: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when drivers is not an array", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({ drivers: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when more than 500 drivers", async () => {
    const drivers = Array.from({ length: 501 }, (_, i) => ({ name: `Driver${i}`, mobile: `050${i}` }));
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({ drivers });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("500");
  });

  it("skips drivers with missing name or mobile", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({
      drivers: [{ name: "", mobile: "0501234567" }, { name: "Khaled", mobile: "" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(0);
    expect(res.body.skipped).toHaveLength(2);
  });

  it("skips duplicate mobile numbers within the batch", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const valuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({
      drivers: [
        { name: "Khaled", mobile: "0501234567" },
        { name: "Khaled2", mobile: "0501234567" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain("مكرر");
  });

  it("skips drivers with already registered mobile", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, mobile: "0501234567" });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({
      drivers: [{ name: "Khaled", mobile: "0501234567" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(0);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain("مسجّل");
  });

  it("imports drivers successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const valuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/import").send({
      drivers: [{ name: "Khaled", mobile: "0501234567" }, { name: "Fahad", mobile: "0509876543" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.skipped).toHaveLength(0);
  });
});

// ===================== GET /admin/drivers/:id =====================

describe("GET /admin/drivers/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).get("/admin/drivers/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp(adminUser);
    const res = await request(app).get("/admin/drivers/999");
    expect(res.status).toBe(404);
  });

  it("returns driver details", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 3, name: "Fahad", mobile: "0509876543", loginCode: "CODE3",
      balance: 150, carType: "Van", nationality: "EG", age: 35, nationalId: "5678",
      status: "ACTIVE", warningCount: 1, createdAt: new Date(),
    });

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/drivers/3");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, name: "Fahad", loginCode: "CODE3" });
  });
});

// ===================== PATCH /admin/drivers/:id =====================

describe("PATCH /admin/drivers/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/abc").send({ name: "New Name" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/999").send({ name: "New Name" });
    expect(res.status).toBe(404);
  });

  it("updates driver successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, name: "Khaled", mobile: "0501234567", loginCode: "CODE1",
      balance: 200, carType: "Sedan", nationality: "SA", age: 30, nationalId: "1234",
      status: "ACTIVE", warningCount: 0, createdAt: new Date(),
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, name: "Khaled Updated", mobile: "0501234567", loginCode: "CODE1",
      balance: 200, carType: "SUV", nationality: "SA", age: 30, nationalId: "1234",
      status: "ACTIVE", warningCount: 0, createdAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/1").send({ name: "Khaled Updated", carType: "SUV" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: "Khaled Updated" });
  });
});

// ===================== POST /admin/drivers/:id/block =====================

describe("POST /admin/drivers/:id/block", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/abc/block");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/999/block");
    expect(res.status).toBe(404);
  });

  it("blocks driver successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, status: "BLOCKED" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/1/block");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "BLOCKED" });
  });
});

// ===================== POST /admin/drivers/:id/unblock =====================

describe("POST /admin/drivers/:id/unblock", () => {
  it("returns 404 when driver not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/999/unblock");
    expect(res.status).toBe(404);
  });

  it("unblocks driver successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, status: "ACTIVE" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/1/unblock");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ACTIVE" });
  });
});

// ===================== POST /admin/drivers/:id/warn =====================

describe("POST /admin/drivers/:id/warn", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/abc/warn");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/999/warn");
    expect(res.status).toBe(404);
  });

  it("warns driver successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, name: "Khaled", warningCount: 0,
    });
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, warningCount: 1 }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/1/warn");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ warningCount: 1 });
  });
});

// ===================== POST /admin/drivers/:id/restore =====================

describe("POST /admin/drivers/:id/restore", () => {
  it("returns 404 when driver not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/999/restore");
    expect(res.status).toBe(404);
  });

  it("restores deleted driver successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, status: "ACTIVE" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/1/restore");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ACTIVE" });
  });
});

// ===================== DELETE /admin/drivers/:id =====================

describe("DELETE /admin/drivers/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/drivers/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/drivers/999");
    expect(res.status).toBe(404);
  });

  it("soft-deletes driver successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, status: "DELETED" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/drivers/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});

// ===================== POST /admin/drivers/:id/regenerate-code =====================

describe("POST /admin/drivers/:id/regenerate-code", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/abc/regenerate-code");
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/999/regenerate-code");
    expect(res.status).toBe(404);
  });

  it("regenerates login code successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // code uniqueness
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, loginCode: "NEWCODE1" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/drivers/1/regenerate-code");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("loginCode");
  });
});

// ===================== PATCH /admin/drivers/:id/balance =====================

describe("PATCH /admin/drivers/:id/balance", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/abc/balance").send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is not a number", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/1/balance").send({ amount: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/999/balance").send({ amount: 100 });
    expect(res.status).toBe(404);
  });

  it("updates driver balance successfully", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, name: "Khaled", balance: 100,
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, name: "Khaled", mobile: "0501234567", balance: 200, status: "ACTIVE", createdAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const valuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/drivers/1/balance").send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, balance: 200 });
  });
});

// ===================== GET /admin/clients =====================

describe("GET /admin/clients", () => {
  it("returns list of clients", async () => {
    const chain = makeChain([
      { id: 1, name: "Ali", mobile: "0501234567", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/clients");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, name: "Ali" });
  });
});

// ===================== POST /admin/clients =====================

describe("POST /admin/clients", () => {
  it("returns 400 when name is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/clients").send({ mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/clients").send({ name: "Ali", password: "pass123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/clients").send({ name: "Ali", mobile: "0501234567" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile already registered", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, mobile: "0501234567" });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/clients").send({ name: "Ali", mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مسجّل");
  });

  it("creates client successfully", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([{
      id: 5, name: "Ali", mobile: "0501234567", createdAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/clients").send({ name: "Ali", mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 5, name: "Ali" });
  });
});

// ===================== PATCH /admin/clients/:id =====================

describe("PATCH /admin/clients/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/clients/abc").send({ name: "New" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when no update data provided", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/clients/1").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is taken by another client", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, mobile: "0509999999" });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/clients/1").send({ mobile: "0509999999" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("لعميل آخر");
  });

  it("returns 404 when client not found", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/clients/999").send({ name: "New Name" });
    expect(res.status).toBe(404);
  });

  it("updates client successfully", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([{
      id: 1, name: "Ali Updated", mobile: "0501234567", createdAt: new Date(),
    }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/clients/1").send({ name: "Ali Updated" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: "Ali Updated" });
  });
});

// ===================== DELETE /admin/clients/:id =====================

describe("DELETE /admin/clients/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/clients/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not found", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain([]));

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/clients/999");
    expect(res.status).toBe(404);
  });

  it("deletes client successfully", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain([{ id: 1 }]));

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/clients/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});

// ===================== GET /admin/requests =====================

describe("GET /admin/requests", () => {
  it("returns list of all requests", async () => {
    const chain = makeChain([
      {
        id: 1, clientId: 5, homeLocation: "Riyadh", workLocation: "KFUPM",
        phone: "0501234567", numberOfPeople: 1, workingDaysPerWeek: 5,
        morningTime: "07:00", eveningTime: null, status: "OPEN",
        selectedDriverId: null, createdAt: new Date(),
      },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/requests");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, status: "OPEN", phoneHidden: false });
  });
});

// ===================== PATCH /admin/requests/:id =====================

describe("PATCH /admin/requests/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/requests/abc").send({ status: "ACTIVE" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when no update data provided", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/requests/1").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/requests/1").send({ status: "INVALID_STATUS" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("الحالة");
  });

  it("returns 404 when request not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/requests/999").send({ status: "ACTIVE" });
    expect(res.status).toBe(404);
  });

  it("updates request status successfully", async () => {
    const updated = {
      id: 1, clientId: 5, homeLocation: "Riyadh", workLocation: "KFUPM",
      phone: "050", numberOfPeople: 1, workingDaysPerWeek: 5,
      morningTime: "07:00", eveningTime: null, status: "ACTIVE",
      selectedDriverId: null, createdAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).patch("/admin/requests/1").send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, status: "ACTIVE" });
  });

  it("updates all valid request statuses", async () => {
    const validStatuses = ["OPEN", "SELECTED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED", "FROZEN"];
    for (const status of validStatuses) {
      const updated = {
        id: 1, clientId: 5, homeLocation: "Riyadh", workLocation: "KFUPM",
        phone: "050", numberOfPeople: 1, workingDaysPerWeek: 5,
        morningTime: "07:00", eveningTime: null, status,
        selectedDriverId: null, createdAt: new Date(),
      };
      const returningMock = vi.fn().mockResolvedValue([updated]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

      const app = createApp(adminUser);
      const res = await request(app).patch("/admin/requests/1").send({ status });
      expect(res.status).toBe(200);
    }
  });
});

// ===================== DELETE /admin/requests/:id =====================

describe("DELETE /admin/requests/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/requests/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain([]));

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/requests/999");
    expect(res.status).toBe(404);
  });

  it("deletes request successfully", async () => {
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain([{ id: 1 }]));

    const app = createApp(adminUser);
    const res = await request(app).delete("/admin/requests/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});

// ===================== POST /admin/change-code =====================

describe("POST /admin/change-code", () => {
  it("returns 400 when newCode is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when newCode is too short (< 6 chars)", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({ newCode: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("6");
  });

  it("returns 400 when newCode is already in use by another admin", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, loginCode: "MYCODE" });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({ newCode: "MYCODE" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مستخدم");
  });

  it("allows reusing own current code", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, loginCode: "MYCODE" });
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, loginCode: "MYCODE" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({ newCode: "MYCODE" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("loginCode");
  });

  it("returns 404 when admin not found in DB", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({ newCode: "NEWCODE99" });
    expect(res.status).toBe(404);
  });

  it("changes code successfully", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, loginCode: "NEWCODE99" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/change-code").send({ newCode: "NEWCODE99" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ loginCode: "NEWCODE99" });
  });
});

// ===================== POST /admin/requests =====================

describe("POST /admin/requests", () => {
  it("returns 400 when body validation fails", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: false });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests").send({});
    expect(res.status).toBe(400);
  });

  it("creates open request without clientId or selectedDriverId", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: {
        homeLocation: "الرياض", workLocation: "جامعة الملك", phone: "0501234567",
        numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
        morningTime: "07:00", eveningTime: null, clientType: "غيره", monthlyPrice: 800,
      },
    });

    const created = {
      id: 10, clientId: null, clientType: "غيره", homeLocation: "الرياض",
      workLocation: "جامعة الملك", phone: "0501234567", numberOfPeople: 1,
      workingDaysPerWeek: 5, numberOfShifts: 1, morningTime: "07:00",
      eveningTime: null, notes: null, monthlyPrice: 800, status: "OPEN",
      selectedDriverId: null, createdBy: "admin", createdAt: new Date(), updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([created]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    // Active drivers to notify (empty list to keep test simple)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([]));

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests").send({
      homeLocation: "الرياض", workLocation: "جامعة الملك", phone: "0501234567",
      numberOfPeople: 1, workingDaysPerWeek: 5, morningTime: "07:00",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 10, status: "OPEN" });
  });

  it("creates SELECTED request when selectedDriverId is provided", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: {
        homeLocation: "الرياض", workLocation: "جامعة الملك", phone: "0501234567",
        numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
        morningTime: "07:00", eveningTime: null, clientType: "غيره", monthlyPrice: 0,
      },
    });

    const created = {
      id: 11, clientId: 3, clientType: "غيره", homeLocation: "الرياض",
      workLocation: "جامعة الملك", phone: "0501234567", numberOfPeople: 1,
      workingDaysPerWeek: 5, numberOfShifts: 1, morningTime: "07:00",
      eveningTime: null, notes: null, monthlyPrice: 0, status: "SELECTED",
      selectedDriverId: 7, createdBy: "admin", createdAt: new Date(), updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([created]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([]));

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests").send({
      homeLocation: "الرياض", workLocation: "جامعة الملك", phone: "0501234567",
      numberOfPeople: 1, workingDaysPerWeek: 5, morningTime: "07:00",
      clientId: 3, selectedDriverId: 7,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 11, status: "SELECTED", selectedDriverId: 7 });
  });

  it("notifies active drivers when creating a new request", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: {
        homeLocation: "الرياض", workLocation: "جامعة", phone: "0501234567",
        numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
        morningTime: "07:00", eveningTime: null, clientType: "غيره", monthlyPrice: 0,
      },
    });

    const created = {
      id: 12, clientId: null, homeLocation: "الرياض", workLocation: "جامعة",
      phone: "0501234567", numberOfPeople: 1, workingDaysPerWeek: 5,
      numberOfShifts: 1, morningTime: "07:00", eveningTime: null, notes: null,
      monthlyPrice: 0, status: "OPEN", selectedDriverId: null,
      clientType: "غيره", createdBy: "admin", createdAt: new Date(), updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([created]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });
    // Two active drivers to notify
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([{ id: 1 }, { id: 2 }]));

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests").send({
      homeLocation: "الرياض", workLocation: "جامعة", phone: "0501234567",
      numberOfPeople: 1, workingDaysPerWeek: 5, morningTime: "07:00",
    });
    expect(res.status).toBe(201);
  });

  it("returns 500 on DB error", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: {
        homeLocation: "الرياض", workLocation: "جامعة", phone: "0501234567",
        numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
        morningTime: "07:00", eveningTime: null, clientType: "غيره", monthlyPrice: 0,
      },
    });
    const valuesMock = vi.fn().mockRejectedValue(new Error("DB error"));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests").send({
      homeLocation: "الرياض", workLocation: "جامعة", phone: "0501234567",
      numberOfPeople: 1, workingDaysPerWeek: 5, morningTime: "07:00",
    });
    expect(res.status).toBe(500);
  });
});

// ===================== POST /admin/requests/:id/select-offer =====================

describe("POST /admin/requests/:id/select-offer", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/abc/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when offerId is missing", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("offerId");
  });

  it("returns 400 when offerId is not a number", async () => {
    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: "abc" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/999/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("الطلب");
  });

  it("returns 400 when request is not OPEN", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "SELECTED", homeLocation: "الرياض", workLocation: "جامعة",
    });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("سائق");
  });

  it("returns 404 when offer not found for this request", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", homeLocation: "الرياض", workLocation: "جامعة",
    });
    // Empty offer result
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([]));

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("العرض");
  });

  it("returns 404 when driver not found", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", homeLocation: "الرياض", workLocation: "جامعة",
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain([{ id: 5, driverId: 7, requestId: 1 }])
    );
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("السائق");
  });

  it("returns 400 when driver has insufficient balance", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", homeLocation: "الرياض", workLocation: "جامعة",
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain([{ id: 5, driverId: 7, requestId: 1 }])
    );
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 7, name: "خالد", balance: 30,
    });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("رصيد");
  });

  it("selects offer successfully: deducts fee, sets SELECTED, returns updated request", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", homeLocation: "الرياض", workLocation: "جامعة",
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain([{ id: 5, driverId: 7, requestId: 1 }])
    );
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 7, name: "خالد", balance: 200,
    });

    // db.update (for balance deduction) and db.update (for request status)
    const requestReturningMock = vi.fn().mockResolvedValue([{
      id: 1, clientId: null, clientType: "غيره",
      homeLocation: "الرياض", workLocation: "جامعة",
      additionalLocations: null, shifts: null,
      phone: "0501234567", numberOfPeople: 1, workingDaysPerWeek: 5,
      numberOfShifts: 1, morningTime: "07:00", eveningTime: null, notes: null,
      monthlyPrice: 800, status: "SELECTED", selectedDriverId: 7,
      createdAt: new Date(), updatedAt: new Date(),
    }]);
    const balanceWhereMock = vi.fn().mockResolvedValue([]);
    const balanceSetMock = vi.fn().mockReturnValue({ where: balanceWhereMock });
    const requestWhereMock = vi.fn().mockReturnValue({ returning: requestReturningMock });
    const requestSetMock = vi.fn().mockReturnValue({ where: requestWhereMock });

    (db.update as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ set: balanceSetMock })   // balance deduction
      .mockReturnValueOnce({ set: requestSetMock });  // request status

    const valuesMock = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp(adminUser);
    const res = await request(app).post("/admin/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, status: "SELECTED", selectedDriverId: 7 });
  });
});

// ===================== GET /admin/recent-events =====================

describe("GET /admin/recent-events", () => {
  it("returns 200 with an array of events", async () => {
    // All four sub-queries return empty lists → no events
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([]));

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes pending wallet transactions in events", async () => {
    const selectMock = vi.fn();
    selectMock
      .mockReturnValueOnce(makeChain([{
        id: 1, driverId: 3, amount: "200", createdAt: new Date(), driverName: "خالد",
      }]))       // wallet transactions
      .mockReturnValue(makeChain([])); // support tickets, requests, offers

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    const walletEvents = res.body.filter((e: { type: string }) => e.type === "wallet");
    expect(walletEvents.length).toBeGreaterThan(0);
    expect(walletEvents[0]).toMatchObject({
      type: "wallet",
      userName: "خالد",
    });
  });

  it("includes open support tickets in events", async () => {
    const selectMock = vi.fn();
    selectMock
      .mockReturnValueOnce(makeChain([])) // wallet
      .mockReturnValueOnce(makeChain([{
        id: 2, type: "complaint", clientId: 1, driverId: null,
        createdAt: new Date(), clientName: "علي",
      }]))
      .mockReturnValue(makeChain([])); // requests, offers, driver-name batch

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    const supportEvents = res.body.filter((e: { type: string }) => e.type === "support");
    expect(supportEvents.length).toBeGreaterThan(0);
    expect(supportEvents[0]).toMatchObject({ type: "support", userName: "علي" });
  });

  it("includes open client requests in events", async () => {
    const selectMock = vi.fn();
    selectMock
      .mockReturnValueOnce(makeChain([]))  // wallet
      .mockReturnValueOnce(makeChain([]))  // support tickets
      .mockReturnValueOnce(makeChain([{
        id: 3, homeLocation: "الرياض", workLocation: "الجامعة",
        clientId: 2, createdAt: new Date(), clientName: "محمد",
      }]))
      .mockReturnValue(makeChain([])); // offers

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    const requestEvents = res.body.filter((e: { type: string }) => e.type === "request");
    expect(requestEvents.length).toBeGreaterThan(0);
    expect(requestEvents[0]).toMatchObject({ type: "request", userName: "محمد" });
  });

  it("includes pending driver offers in events", async () => {
    const selectMock = vi.fn();
    selectMock
      .mockReturnValueOnce(makeChain([]))  // wallet
      .mockReturnValueOnce(makeChain([]))  // support tickets
      .mockReturnValueOnce(makeChain([]))  // requests
      .mockReturnValueOnce(makeChain([{   // offers
        id: 4, driverId: 5, requestId: 7, createdAt: new Date(), driverName: "فهد",
      }]));

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    const offerEvents = res.body.filter((e: { type: string }) => e.type === "offer");
    expect(offerEvents.length).toBeGreaterThan(0);
    expect(offerEvents[0]).toMatchObject({ type: "offer", userName: "فهد" });
  });

  it("returns at most 20 events sorted by date descending", async () => {
    // Create 25 wallet events to verify truncation to 20
    const walletRows = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1, driverId: i + 1, amount: "100",
      createdAt: new Date(Date.now() - i * 1000), driverName: `سائق${i + 1}`,
    }));

    const selectMock = vi.fn();
    selectMock
      .mockReturnValueOnce(makeChain(walletRows))
      .mockReturnValue(makeChain([]));

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(20);
  });

  it("returns 500 on DB error", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("DB failure");
    });

    const app = createApp(adminUser);
    const res = await request(app).get("/admin/recent-events");
    expect(res.status).toBe(500);
  });
});
