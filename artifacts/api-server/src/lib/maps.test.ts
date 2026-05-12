import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { haversineKm } from "@workspace/db/utils/pricing";

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { calculateRoutePlan } from "./maps";

const POINTS = [
  { lat: 0, lng: 0, address: "A", type: "pickup" },
  { lat: 0, lng: 1, address: "B", type: "dropoff" },
];

describe("maps.calculateRoutePlan", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["OPENROUTESERVICE_API_KEY"];
    delete process.env["OPENROUTESERVICE_API_URL"];
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("falls back to haversine when ORS is not configured", async () => {
    const route = await calculateRoutePlan(POINTS);
    expect(route.routePolyline).toBe("");
    expect(route.distanceKm).toBeCloseTo(haversineKm(0, 0, 0, 1), 3);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(route.coordinates.pickup?.lat).toBe(0);
    expect(route.coordinates.dropoff?.lng).toBe(1);
  });

  it("falls back to haversine when ORS fetch throws", async () => {
    process.env["OPENROUTESERVICE_API_KEY"] = "test";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));

    const route = await calculateRoutePlan(POINTS);
    expect(route.routePolyline).toBe("");
    expect(route.distanceKm).toBeCloseTo(haversineKm(0, 0, 0, 1), 3);
  });

  it("falls back to haversine on invalid ORS response", async () => {
    process.env["OPENROUTESERVICE_API_KEY"] = "test";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ routes: [{ geometry: null, summary: null }] }),
    } as unknown as Response);

    const route = await calculateRoutePlan(POINTS);
    expect(route.routePolyline).toBe("");
    expect(route.distanceKm).toBeCloseTo(haversineKm(0, 0, 0, 1), 3);
  });

  it("retries with larger radius when ORS cannot find a routable point", async () => {
    process.env["OPENROUTESERVICE_API_KEY"] = "test";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 2010,
            message:
              "Could not find routable point within a radius of 350.0 meters of specified coordinate 1",
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ geometry: "poly", summary: { distance: 1000, duration: 600 } }],
        }),
      } as unknown as Response);

    const route = await calculateRoutePlan(POINTS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(route.routePolyline).toBe("poly");
    expect(route.distanceKm).toBeCloseTo(1, 5);
    expect(route.durationMinutes).toBeCloseTo(10, 5);
  });

  it("falls back when ORS routable-point retry also fails", async () => {
    process.env["OPENROUTESERVICE_API_KEY"] = "test";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 2010,
            message:
              "Could not find routable point within a radius of 350.0 meters of specified coordinate 1",
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 2010,
            message:
              "Could not find routable point within a radius of 2000.0 meters of specified coordinate 1",
          },
        }),
      } as unknown as Response);

    const route = await calculateRoutePlan(POINTS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(route.routePolyline).toBe("");
    expect(route.distanceKm).toBeCloseTo(haversineKm(0, 0, 0, 1), 3);
  });
});
