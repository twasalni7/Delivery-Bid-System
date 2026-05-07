import { describe, expect, it } from "vitest";
import { resolveRequestStatus } from "./request-status-engine";

describe("request-status-engine", () => {
  it("resolves request_created to OPEN/FROZEN/SELECTED", () => {
    expect(
      resolveRequestStatus({
        currentStatus: "OPEN",
        selectedDriverId: null,
        needsAdminReview: false,
        event: "request_created",
      }).status,
    ).toBe("OPEN");

    expect(
      resolveRequestStatus({
        currentStatus: "OPEN",
        selectedDriverId: null,
        needsAdminReview: true,
        event: "request_created",
      }).status,
    ).toBe("FROZEN");

    expect(
      resolveRequestStatus({
        currentStatus: "OPEN",
        selectedDriverId: 9,
        needsAdminReview: true,
        event: "request_created",
      }).status,
    ).toBe("SELECTED");
  });

  it("forces SELECTED on offer_selected and selected_driver_assigned", () => {
    expect(
      resolveRequestStatus({
        currentStatus: "OPEN",
        selectedDriverId: 1,
        needsAdminReview: false,
        event: "offer_selected",
      }).status,
    ).toBe("SELECTED");

    expect(
      resolveRequestStatus({
        currentStatus: "FROZEN",
        selectedDriverId: 1,
        needsAdminReview: true,
        event: "selected_driver_assigned",
      }).status,
    ).toBe("SELECTED");
  });

  it("keeps locked statuses unchanged for sync/update events", () => {
    for (const status of ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"] as const) {
      expect(
        resolveRequestStatus({
          currentStatus: status,
          selectedDriverId: null,
          needsAdminReview: false,
          event: "admin_request_updated",
        }).status,
      ).toBe(status);
    }
  });

  it("resolves non-locked statuses on admin_request_updated/background_sync", () => {
    const events = ["admin_request_updated", "background_sync"] as const;

    for (const event of events) {
      expect(
        resolveRequestStatus({
          currentStatus: "SELECTED",
          selectedDriverId: null,
          needsAdminReview: false,
          event,
        }).status,
      ).toBe("OPEN");
      expect(
        resolveRequestStatus({
          currentStatus: "OPEN",
          selectedDriverId: null,
          needsAdminReview: true,
          event,
        }).status,
      ).toBe("FROZEN");
      expect(
        resolveRequestStatus({
          currentStatus: "FROZEN",
          selectedDriverId: 4,
          needsAdminReview: true,
          event,
        }).status,
      ).toBe("SELECTED");
    }
  });
});
