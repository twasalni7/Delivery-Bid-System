import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

vi.mock("web-push", () => ({
  default: {
    sendNotification: sendNotificationMock,
    setVapidDetails: setVapidDetailsMock,
  },
}));

vi.mock("@workspace/db", () => {
  const mockDb = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      pushSubscriptionsTable: {
        findFirst: vi.fn(),
      },
    },
  };

  return {
    db: mockDb,
    pool: {
      query: vi.fn(),
    },
    notificationsTable: {
      id: "id",
      deliveredAt: "delivered_at",
    },
    pushSubscriptionsTable: {
      userId: "user_id",
      userRole: "user_role",
      subscriptionData: "subscription_data",
    },
    driversTable: {
      id: "id",
      status: "status",
    },
    adminsTable: {
      id: "id",
    },
    eq: vi.fn((...args: unknown[]) => args),
    and: vi.fn((...args: unknown[]) => args),
  };
});

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db, pool } from "@workspace/db";
import { clearExpiredSubscription, notify } from "./notify";

function flushAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["VAPID_PUBLIC_KEY"] = "public-key";
  process.env["VAPID_PRIVATE_KEY"] = "private-key";
});

describe("notify", () => {
  it("falls back to the legacy push_subscriptions schema when user_role is unavailable", async () => {
    const insertReturningMock = vi.fn().mockResolvedValue([{ id: 123 }]);
    const insertValuesMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValuesMock });

    const updateWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSetMock });

    (db.query.pushSubscriptionsTable.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('column "user_role" does not exist'), { code: "42703" })
    );
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        {
          subscription_data: {
            endpoint: "https://example.com/push",
            keys: { auth: "auth-key", p256dh: "p256dh-key" },
          },
        },
      ],
    });
    sendNotificationMock.mockResolvedValue(undefined);

    await notify({
      userId: 1,
      userRole: "client",
      title: "Test",
      message: "Hello",
      type: "system",
      url: "/admin/support?ticket=42#reply",
    });

    await flushAsyncWork();
    await flushAsyncWork();

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT subscription_data"),
      [1]
    );
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const [, payload] = sendNotificationMock.mock.calls[0]!;
    expect(JSON.parse(payload)).toMatchObject({
      title: "Test",
      body: "Hello",
      notificationId: 123,
      url: "/admin/support?ticket=42#reply",
    });
  });
});

describe("clearExpiredSubscription", () => {
  it("falls back to deleting by user_id on the legacy push_subscriptions schema", async () => {
    const deleteWhereMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('column "user_role" does not exist'), { code: "42703" })
    );
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: deleteWhereMock });
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

    await clearExpiredSubscription(9, "client");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM push_subscriptions"),
      [9]
    );
  });
});
