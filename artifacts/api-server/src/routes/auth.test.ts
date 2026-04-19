import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock @workspace/db before any route imports
vi.mock("@workspace/db", () => {
  const mockDb = {
    query: {
      clientsTable: { findFirst: vi.fn() },
      driversTable: { findFirst: vi.fn() },
      adminsTable: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn() })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })),
    })),
  };
  return {
    db: mockDb,
    clientsTable: {},
    driversTable: {},
    adminsTable: {},
    eq: vi.fn(),
  };
});

// Mock lib/auth
vi.mock("../lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed.salt"),
  comparePassword: vi.fn().mockResolvedValue(true),
  generateLoginCode: vi.fn().mockReturnValue("ABCD1234"),
}));

import { db } from "@workspace/db";
import authRouter from "../routes/auth";

function createApp() {
  const app = express();
  app.use(express.json());
  // Minimal session mock middleware
  app.use((req: any, _res, next) => {
    req.session = req.session ?? { user: undefined, destroy: (cb: () => void) => cb() };
    next();
  });
  app.use("/auth", authRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /auth/register-client", () => {
  it("returns 400 when name is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/register-client")
      .send({ mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when mobile is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/register-client")
      .send({ name: "Ali", password: "pass123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/register-client")
      .send({ name: "Ali", mobile: "0501234567" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is already registered", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      mobile: "0501234567",
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/register-client")
      .send({ name: "Ali", mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مسجّل");
  });

  it("creates a new client and returns 201", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([
      { id: 5, name: "Ali", mobile: "0501234567" },
    ]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    const app = createApp();
    const res = await request(app)
      .post("/auth/register-client")
      .send({ name: "Ali", mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 5, name: "Ali", role: "client" });
  });
});

describe("POST /auth/login-client", () => {
  it("returns 400 when mobile is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-client")
      .send({ password: "pass123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-client")
      .send({ mobile: "0501234567" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when client not found", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-client")
      .send({ mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when password is incorrect", async () => {
    const { comparePassword } = await import("../lib/auth");
    (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      mobile: "0501234567",
      passwordHash: "hashed.salt",
      name: "Ali",
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-client")
      .send({ mobile: "0501234567", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with user data on successful login", async () => {
    const { comparePassword } = await import("../lib/auth");
    (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      mobile: "0501234567",
      passwordHash: "hashed.salt",
      name: "Ali",
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-client")
      .send({ mobile: "0501234567", password: "pass123" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: "Ali", role: "client" });
  });
});

describe("POST /auth/login-driver", () => {
  it("returns 400 when mobile is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ loginCode: "ABCD1234" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when loginCode is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when driver not found", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567", loginCode: "ABCD1234" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when loginCode does not match", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      mobile: "0501234567",
      loginCode: "DIFFERENT",
      name: "Khaled",
      status: "ACTIVE",
      balance: 100,
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567", loginCode: "ABCD1234" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when driver is BLOCKED", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      mobile: "0501234567",
      loginCode: "ABCD1234",
      name: "Khaled",
      status: "BLOCKED",
      balance: 100,
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567", loginCode: "ABCD1234" });
    expect(res.status).toBe(403);
  });

  it("returns 403 when driver is DELETED", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      mobile: "0501234567",
      loginCode: "ABCD1234",
      name: "Khaled",
      status: "DELETED",
      balance: 100,
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567", loginCode: "ABCD1234" });
    expect(res.status).toBe(403);
  });

  it("returns 200 with driver data on successful login", async () => {
    (db.query.driversTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      mobile: "0501234567",
      loginCode: "ABCD1234",
      name: "Khaled",
      status: "ACTIVE",
      balance: 200,
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-driver")
      .send({ mobile: "0501234567", loginCode: "ABCD1234" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, name: "Khaled", role: "driver", balance: 200 });
  });
});

describe("POST /auth/login-admin", () => {
  it("returns 400 when loginCode is missing", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/login-admin").send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 when loginCode is invalid", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-admin")
      .send({ loginCode: "BADCODE" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with admin data on successful login", async () => {
    (db.query.adminsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 10,
      name: "Admin",
      loginCode: "ADMINCODE",
    });
    const app = createApp();
    const res = await request(app)
      .post("/auth/login-admin")
      .send({ loginCode: "ADMINCODE" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10, name: "Admin", role: "admin" });
  });
});

describe("GET /auth/me", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user data when authenticated", async () => {
    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser).get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, role: "client", name: "Ali" });
  });
});

describe("POST /auth/logout", () => {
  it("destroys session and returns success message", async () => {
    const app = createApp();
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});

describe("PATCH /auth/me/client", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/auth/me/client")
      .send({ name: "New Name" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no data to update", async () => {
    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser).patch("/auth/me/client").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when mobile is already taken by another client", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 99,
      mobile: "0509999999",
    });
    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/client")
      .send({ mobile: "0509999999" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("مسجّل");
  });

  it("updates client profile successfully", async () => {
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const returningMock = vi.fn().mockResolvedValue([{ id: 1, name: "Ali Updated", mobile: "0501234567" }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/client")
      .send({ name: "Ali Updated" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Ali Updated" });
  });
});

describe("PATCH /auth/me/password", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/auth/me/password")
      .send({ currentPassword: "old", newPassword: "newpass123" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when currentPassword is missing", async () => {
    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/password")
      .send({ newPassword: "newpass123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is too short", async () => {
    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/password")
      .send({ currentPassword: "oldpass", newPassword: "123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when current password is wrong", async () => {
    const { comparePassword } = await import("../lib/auth");
    (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      passwordHash: "hashed.salt",
    });

    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/password")
      .send({ currentPassword: "wrongpass", newPassword: "newpass123" });
    expect(res.status).toBe(400);
  });

  it("changes password successfully", async () => {
    const { comparePassword } = await import("../lib/auth");
    (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (db.query.clientsTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      passwordHash: "hashed.salt",
    });
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const appWithUser = express();
    appWithUser.use(express.json());
    appWithUser.use((req: any, _res, next) => {
      req.session = {
        user: { id: 1, role: "client", name: "Ali" },
        destroy: (cb: () => void) => cb(),
      };
      next();
    });
    appWithUser.use("/auth", authRouter);

    const res = await request(appWithUser)
      .patch("/auth/me/password")
      .send({ currentPassword: "oldpass", newPassword: "newpass123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
