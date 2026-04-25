import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import healthRouter from "../routes/health";

function createApp() {
  const app = express();
  app.use(healthRouter);
  return app;
}

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
