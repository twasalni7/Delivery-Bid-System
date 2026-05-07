import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(actual.eq),
  };
});

vi.mock("@workspace/db", () => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  };
  return {
    db: mockDb,
    requestsTable: {
      id: "id",
      status: "status",
      selectedDriverId: "selectedDriverId",
      needsAdminReview: "needsAdminReview",
      statusManuallySetByAdmin: "statusManuallySetByAdmin",
      updatedAt: "updatedAt",
    },
  };
});

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runRequestStatusSync } from "./request-status-sync";

describe("request-status-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates inconsistent statuses and returns updated count", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        {
          id: 1,
          status: "OPEN",
          selectedDriverId: null,
          needsAdminReview: true,
          statusManuallySetByAdmin: true,
        },
        {
          id: 2,
          status: "OPEN",
          selectedDriverId: null,
          needsAdminReview: false,
          statusManuallySetByAdmin: false,
        },
        {
          id: 3,
          status: "OPEN",
          selectedDriverId: null,
          needsAdminReview: true,
          statusManuallySetByAdmin: false,
        },
      ]),
    });

    const returning = vi.fn().mockResolvedValue([{ id: 3, status: "FROZEN" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set });

    const updatedCount = await runRequestStatusSync();
    expect(updatedCount).toBe(1);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("id", 3);
    expect(eq).not.toHaveBeenCalledWith("id", 1);
  });
});
