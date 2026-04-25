import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      requestsTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
      offersTable: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    requestsTable: {},
    driversTable: {},
    offersTable: {},
    transactionsTable: {},
    eq: vi.fn(),
    and: vi.fn(),
    count: vi.fn().mockReturnValue("count_expr"),
    inArray: vi.fn(),
    desc: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
  };
});

vi.mock("@workspace/api-zod", () => ({
  CreateRequestBody: {
    safeParse: vi.fn(),
  },
  UpdateRequestStatusBody: {
    safeParse: vi.fn(),
  },
  SelectOfferBody: {
    safeParse: vi.fn(),
  },
  ListRequestsQueryParams: {
    safeParse: vi.fn().mockReturnValue({ success: false }),
  },
}));

vi.mock("../lib/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "@workspace/db";
import { CreateRequestBody, UpdateRequestStatusBody, SelectOfferBody } from "@workspace/api-zod";
import requestsRouter from "../routes/requests";

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(result);
  chain.groupBy = vi.fn().mockResolvedValue([]);
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
  app.use("/requests", requestsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /requests", () => {
  it("returns list of requests", async () => {
    const chain = makeSelectChain([]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const app = createApp();
    const res = await request(app).get("/requests");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /requests (client creates request)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/requests").send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as driver", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/requests").send({});
    expect(res.status).toBe(403);
  });

  it("returns 400 when body validation fails", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: false });
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests").send({ invalid: true });
    expect(res.status).toBe(400);
  });

  it("creates request successfully", async () => {
    (CreateRequestBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: {
        homeLocation: "Riyadh",
        workLocation: "KFUPM",
        phone: "0501234567",
        numberOfPeople: 1,
        workingDaysPerWeek: 5,
        numberOfShifts: 1,
        morningTime: "07:00",
        eveningTime: "17:00",
        clientType: "موظفات",
      },
    });
    const returningMock = vi.fn().mockResolvedValue([{
      id: 10,
      clientId: 1,
      clientType: "موظفات",
      homeLocation: "Riyadh",
      workLocation: "KFUPM",
      phone: "0501234567",
      numberOfPeople: 1,
      workingDaysPerWeek: 5,
      numberOfShifts: 1,
      morningTime: "07:00",
      eveningTime: "17:00",
      status: "OPEN",
      selectedDriverId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests").send({
      homeLocation: "Riyadh",
      workLocation: "KFUPM",
      phone: "0501234567",
      numberOfPeople: 1,
      workingDaysPerWeek: 5,
      numberOfShifts: 1,
      morningTime: "07:00",
      eveningTime: "17:00",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 10, status: "OPEN" });
  });
});

describe("GET /requests/:id", () => {
  it("returns 400 for non-numeric id", async () => {
    const app = createApp();
    const res = await request(app).get("/requests/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp();
    const res = await request(app).get("/requests/999");
    expect(res.status).toBe(404);
  });

  it("returns 403 when client accesses another client's request", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, clientId: 99, status: "OPEN", selectedDriverId: null,
      homeLocation: "Riyadh", workLocation: "KFUPM", phone: "050",
      numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
      morningTime: "07:00", eveningTime: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/requests/5");
    expect(res.status).toBe(403);
  });

  it("returns request data for the owning client", async () => {
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, clientId: 1, status: "OPEN", selectedDriverId: null,
      homeLocation: "Riyadh", workLocation: "KFUPM", phone: "050",
      numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
      morningTime: "07:00", eveningTime: null, clientType: "غيره",
      createdAt: new Date(), updatedAt: new Date(),
    });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).get("/requests/5");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5, status: "OPEN" });
  });
});

describe("PATCH /requests/:id/status (admin updates status)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/requests/1/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as client", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).patch("/requests/1/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    (UpdateRequestStatusBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: true, data: { status: "ACTIVE" } });
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/abc/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body validation fails", async () => {
    (UpdateRequestStatusBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: false });
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/1/status").send({ status: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    (UpdateRequestStatusBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { status: "ACTIVE" },
    });
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/999/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(404);
  });

  it("updates status successfully", async () => {
    (UpdateRequestStatusBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      data: { status: "ACTIVE" },
    });
    const updated = {
      id: 1, clientId: 5, status: "ACTIVE", selectedDriverId: null,
      homeLocation: "Riyadh", workLocation: "KFUPM", phone: "050",
      numberOfPeople: 1, workingDaysPerWeek: 5, numberOfShifts: 1,
      morningTime: "07:00", eveningTime: null, clientType: "غيره",
      createdAt: new Date(), updatedAt: new Date(),
    };
    const returningMock = vi.fn().mockResolvedValue([updated]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/1/status").send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, status: "ACTIVE" });
  });
});

describe("POST /requests/:id/select-offer (client selects offer)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not a client", async () => {
    const app = createApp({ id: 2, role: "driver", name: "Khaled" });
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body validation fails", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: false });
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/1/select-offer").send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true, data: { offerId: 5 },
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/999/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(404);
  });

  it("returns 403 when client does not own the request", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true, data: { offerId: 5 },
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, clientId: 99, status: "OPEN",
    });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(403);
  });

  it("returns 400 when request is not in OPEN status", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true, data: { offerId: 5 },
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, clientId: 1, status: "SELECTED",
    });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when offer not found for this request", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true, data: { offerId: 5 },
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, clientId: 1, status: "OPEN",
    });
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(404);
  });

  it("returns 400 when driver has insufficient balance", async () => {
    (SelectOfferBody.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true, data: { offerId: 5 },
    });
    (db.query.requestsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, clientId: 1, status: "OPEN",
    });
    (db.query.offersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, driverId: 2, requestId: 1,
    });
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, name: "Khaled", balance: 30,
    });

    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).post("/requests/1/select-offer").send({ offerId: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("رصيد");
  });
});

describe("DELETE /requests/:id (admin only)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).delete("/requests/1");
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    const app = createApp({ id: 1, role: "client", name: "Ali" });
    const res = await request(app).delete("/requests/1");
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-numeric id", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/requests/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/requests/999");
    expect(res.status).toBe(404);
  });

  it("deletes request successfully", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).delete("/requests/1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});

describe("PATCH /requests/:id (admin patch)", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).patch("/requests/1").send({ status: "ACTIVE" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no update data provided", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/1").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when status value is invalid", async () => {
    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/1").send({ status: "INVALID_STATUS" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const app = createApp({ id: 1, role: "admin", name: "Admin" });
    const res = await request(app).patch("/requests/999").send({ status: "ACTIVE" });
    expect(res.status).toBe(404);
  });
});
