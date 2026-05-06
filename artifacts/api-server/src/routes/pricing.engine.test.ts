import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    query: {
      appConfigTable: { findFirst: vi.fn() },
    },
  },
  appConfigTable: {},
  requestsTable: {},
  pricingMatrixTable: {},
}));
import {
  calculateSubscriptionPriceV2,
  getTripTypeFromShifts,
  resolvePricingEngine,
  resolveTripsPerDay,
} from "./pricing";

describe("pricing formula v2", () => {
  it("calculates one-way monthly totals", () => {
    const result = calculateSubscriptionPriceV2({
      distance: 10,
      daysPerWeek: 5,
      type: "one_way",
      persons: 1,
      locations: 1,
    });

    // 10km * 1 * 5 * 4 = 200km; 200*0.85 + (20 visits*15) = 170 + 300 = 470
    expect(result.totalPrice).toBe(470);
    expect(result.pricePerPerson).toBe(470);
    expect(result.details.monthlyKm).toBe(200);
    expect(result.details.monthlyTrips).toBe(20);
  });

  it("increases total for extra passengers and locations", () => {
    const single = calculateSubscriptionPriceV2({
      distance: 30,
      daysPerWeek: 5,
      type: "round_trip",
      persons: 1,
      locations: 1,
    });
    const shared = calculateSubscriptionPriceV2({
      distance: 30,
      daysPerWeek: 5,
      type: "round_trip",
      persons: 4,
      locations: 3,
    });

    expect(shared.totalPrice).toBeGreaterThan(single.totalPrice);
    expect(shared.pricePerPerson).toBeLessThan(shared.totalPrice);
  });
});

describe("pricing engine mapping helpers", () => {
  it("maps trip count to known types", () => {
    expect(resolveTripsPerDay("one_way")).toBe(1);
    expect(resolveTripsPerDay("round_trip")).toBe(2);
    expect(resolveTripsPerDay("shift")).toBe(4);
    expect(resolveTripsPerDay(3)).toBe(3);
  });

  it("maps shifts to formula type and keeps matrix default engine", () => {
    expect(getTripTypeFromShifts(1, null)).toBe("one_way");
    expect(getTripTypeFromShifts(2, null)).toBe("round_trip");
    expect(getTripTypeFromShifts(4, null)).toBe("shift");
    expect(getTripTypeFromShifts(3, null)).toBe(3);
    expect(resolvePricingEngine(undefined)).toBe("matrix");
    expect(resolvePricingEngine("formula_v2")).toBe("formula_v2");
  });
});
