import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      offersTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
      requestsTable: { findFirst: vi.fn() },
      appConfigTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    offersTable: {},
    driversTable: {},
    requestsTable: {},
    eq: vi.fn(),
    and: vi.fn(),
    count: vi.fn().mockReturnValue("count_expr"),
  };
});

vi.mock("@workspace/api-zod", () => ({
  CreateOfferBody: {
    safeParse: vi.fn(),
  },
}));

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
  notifyAllAdmins: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@workspace/db";
import { CreateOfferBody } from "@workspace/api-zod";
import offersRouter from "../routes/offers";

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
  app.use("/offers", offersRouter);
  return app;
}

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /offers (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/offers");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/offers");
    expect(res.status).toBe(403);
  });

  it("returns offers list when admin", async () => {
    const chain = makeSelectChain([
      { id: 1, driverId: 2, requestId: 3, status: "PENDING", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", mobile: "0501234567", balance: 100,
      carType: "Sedan", nationality: "SA", status: "ACTIVE", createdAt: new Date(),
    });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).get("/offers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 1, status: "PENDING" });
  });
});

describe("GET /offers/my (driver only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/offers/my");
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/offers/my");
    expect(res.status).toBe(403);
  });

  it("returns driver's own offers", async () => {
    const chain = makeSelectChain([
      { id: 5, driverId: 2, requestId: 10, status: "PENDING", createdAt: new Date() },
    ]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      status: "OPEN",
      homeLocation: "Riyadh",
      workLocation: "KFUPM",
      morningTime: "07:00",
      eveningTime: "17:00",
      numberOfPeople: 1,
      workingDaysPerWeek: 5,
      monthlyPrice: 800,
    });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).get("/offers/my");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /offers (driver creates offer)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body validation fails", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: false });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/offers").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when driver has insufficient balance", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { requestId: 1 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 30, status: "ACTIVE",
    });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("رصيد");
  });

  it("returns 404 when request not found", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { requestId: 99 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 200, status: "ACTIVE",
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 99 });
    expect(res.status).toBe(404);
  });

  it("returns 400 when request is not open for bidding", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { requestId: 1 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 200, status: "ACTIVE",
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "SELECTED", clientId: 5,
    });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when driver has already accepted this request", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { requestId: 1 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 200, status: "ACTIVE",
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", clientId: 5,
    });
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10, driverId: 2, requestId: 1,
    });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مسبقاً");
  });

  it("accepts request successfully", async () => {
    (CreateOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { requestId: 1 },
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 200, status: "ACTIVE",
      carType: "Sedan", nationality: "SA", createdAt: new Date(),
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, status: "OPEN", clientId: 5, homeLocation: "Riyadh",
    });
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const returningMock = vi.fn().mockResolvedValue([
      { id: 20, driverId: 2, requestId: 1, status: "PENDING", createdAt: new Date() },
    ]);
    const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app)
      .post("/offers")
      .send({ requestId: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 20, status: "PENDING" });
  });
});

describe("DELETE /offers/:id (driver withdraws offer)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).delete("/offers/1");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/offers/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when offer not found", async () => {
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/offers/999");
    expect(res.status).toBe(404);
  });

  it("returns 403 when driver tries to delete another driver's offer", async () => {
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 99, requestId: 5,
    });
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/offers/1");
    expect(res.status).toBe(403);
  });

  it("returns 400 when request is not open for bidding", async () => {
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, requestId: 5,
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, status: "ACTIVE",
    });
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/offers/1");
    expect(res.status).toBe(400);
  });

  it("deletes offer successfully", async () => {
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, driverId: 2, requestId: 5, status: "PENDING",
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, status: "OPEN",
    });
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).delete("/offers/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
