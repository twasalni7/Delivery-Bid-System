import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      bankAccountsTable: { findFirst: vi.fn() },
      adminsTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    bankAccountsTable: { isActive: "isActive", createdAt: "createdAt", id: "id", intId: "int_id" },
    adminsTable: { id: "id" },
    eq: vi.fn(),
  };
});

import { db } from "@workspace/db";
import bankAccountsRouter from "../routes/bank-accounts";

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
  app.use("/bank-accounts", bankAccountsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /bank-accounts (active accounts, any auth)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/bank-accounts");
    expect(res.status).toBe(401);
  });

  it("returns active bank accounts for authenticated user", async () => {
    const chain = makeSelectChain([
      { id: 1, bankName: "Al Rajhi", iban: "SA123", accountHolderName: "Company", isActive: true, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "driver", name: "Khaled" });
    const res = await request(app).get("/bank-accounts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, bankName: "Al Rajhi" });
  });

  it("returns accounts for client role", async () => {
    const chain = makeSelectChain([]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/bank-accounts");
    expect(res.status).toBe(200);
  });
});

describe("GET /bank-accounts/all (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/bank-accounts/all");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as driver", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/bank-accounts/all");
    expect(res.status).toBe(403);
  });

  it("returns all accounts including inactive for admin", async () => {
    const chain = makeSelectChain([
      { id: 1, bankName: "Al Rajhi", iban: "SA123", accountHolderName: "Company", isActive: true, createdAt: new Date() },
      { id: 2, bankName: "NCB", iban: "SA456", accountHolderName: "Firm", isActive: false, createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/bank-accounts/all");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });
});

describe("POST /bank-accounts (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/bank-accounts").send({ bankName: "X", iban: "Y", accountHolderName: "Z" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/bank-accounts").send({ bankName: "X", iban: "Y", accountHolderName: "Z" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when bankName is missing", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/bank-accounts").send({ iban: "Y", accountHolderName: "Z" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when iban is missing", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/bank-accounts").send({ bankName: "X", accountHolderName: "Z" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when accountHolderName is missing", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/bank-accounts").send({ bankName: "X", iban: "Y" });
    expect(res.status).toBe(400);
  });

  it("creates bank account successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{
      id: 3, bankName: "Al Rajhi", iban: "SA0380000000608010167519", accountHolderName: "Company", isActive: true, createdAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).post("/bank-accounts").send({
      bankName: "Al Rajhi", iban: "SA0380000000608010167519", accountHolderName: "Company",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 3, bankName: "Al Rajhi" });
  });
});

describe("PATCH /bank-accounts/:id (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/bank-accounts/1").send({ isActive: false });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/bank-accounts/1").send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/bank-accounts/abc").send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it("returns 400 when no update data provided", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/bank-accounts/1").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when account not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/bank-accounts/999").send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it("updates bank account successfully", async () => {
    const existing = { id: 1, bankName: "Al Rajhi", iban: "SA123", accountHolderName: "Company", isActive: true, createdAt: new Date() };
    (db.query.bankAccountsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const updated = { ...existing, isActive: false };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/bank-accounts/1").send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, isActive: false });
  });

  it("coerces isActive to boolean", async () => {
    const existing = { id: 1, bankName: "Al Rajhi", iban: "SA123", accountHolderName: "Company", isActive: false, createdAt: new Date() };
    (db.query.bankAccountsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const updated = { ...existing, isActive: true };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/bank-accounts/1").send({ isActive: 1 });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /bank-accounts/:id (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).delete("/bank-accounts/1");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as driver", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/bank-accounts/1");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/bank-accounts/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when account not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/bank-accounts/999");
    expect(res.status).toBe(404);
  });

  it("deletes bank account successfully", async () => {
    const existing = { id: 1, bankName: "Al Rajhi", iban: "SA123", accountHolderName: "Company", isActive: true, createdAt: new Date() };
    (db.query.bankAccountsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/bank-accounts/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
