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

  it("maps shifts to formula type and default engine is formula_v2", () => {
    expect(getTripTypeFromShifts(1, null)).toBe("one_way");
    expect(getTripTypeFromShifts(2, null)).toBe("round_trip");
    expect(getTripTypeFromShifts(4, null)).toBe("shift");
    expect(getTripTypeFromShifts(3, null)).toBe(3);
    // With numberOfShifts=1 and returnTime, should be round_trip
    expect(getTripTypeFromShifts(1, [{ goTime: "07:00", returnTime: "15:00" }], "15:00")).toBe("round_trip");
    // With numberOfShifts=4 (multiple daily shifts), should be shift
    expect(
      getTripTypeFromShifts(4, [
        { goTime: "07:00", returnTime: "12:00" },
        { goTime: "13:00", returnTime: "18:00" },
      ], "12:00")
    ).toBe("shift");
    expect(getTripTypeFromShifts(1, null, "15:00")).toBe("round_trip");
    // default engine (no config) is now formula_v2
    expect(resolvePricingEngine(undefined)).toBe("formula_v2");
    expect(resolvePricingEngine(null)).toBe("formula_v2");
    expect(resolvePricingEngine("formula_v2")).toBe("formula_v2");
    // matrix can still be selected explicitly (revert capability preserved)
    expect(resolvePricingEngine("matrix")).toBe("matrix");
  });

  it("prioritizes numberOfShifts over shifts array for variable schedule", () => {
    // Variable schedule: different times per day, but still round_trip pricing
    const variableScheduleShifts = [
      { goTime: "07:00", returnTime: "14:00", label: "الأحد" },
      { goTime: "08:00", returnTime: "15:00", label: "الإثنين" },
      { goTime: "07:30", returnTime: "14:30", label: "الثلاثاء" },
    ];
    // When numberOfShifts=1 with evening time, should be round_trip (not count all shifts)
    expect(getTripTypeFromShifts(1, variableScheduleShifts, "14:00")).toBe("round_trip");

    // Multiple daily shifts: count all shift trips
    const multipleShifts = [
      { goTime: "07:00", returnTime: "12:00" },
      { goTime: "13:00", returnTime: "18:00" },
    ];
    // When numberOfShifts=4, use that value
    expect(getTripTypeFromShifts(4, multipleShifts, "12:00")).toBe("shift");

    // Legacy: without numberOfShifts, count shifts array
    expect(getTripTypeFromShifts(null, multipleShifts, null)).toBe("shift");
  });

  it("handles one-way variable schedule", () => {
    const variableOneWay = [
      { goTime: "07:00", label: "الأحد" },
      { goTime: "08:00", label: "الإثنين" },
    ];
    // numberOfShifts=1 without evening time = one_way
    expect(getTripTypeFromShifts(1, variableOneWay, null)).toBe("one_way");
    expect(getTripTypeFromShifts(1, variableOneWay, "")).toBe("one_way");
  });
});
