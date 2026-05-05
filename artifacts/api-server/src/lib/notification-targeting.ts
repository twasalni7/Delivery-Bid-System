import { adminsTable, clientsTable, db, driversTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type NotificationUserRole = "client" | "driver" | "admin";
export type NotificationFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_null"
  | "not_null";

export type NotificationFilter = {
  field: string;
  operator: NotificationFilterOperator;
  value?: unknown;
};

export type NotificationAudience =
  | { mode: "all" }
  | { mode: "roles"; roles: NotificationUserRole[] }
  | { mode: "user"; userId: number; userRole: NotificationUserRole }
  | {
      mode: "filters";
      segments: Array<{
        role: NotificationUserRole;
        filters: NotificationFilter[];
      }>;
    };

type TargetFieldType = "string" | "number" | "date" | "enum";

export type TargetFieldMetadata = {
  key: string;
  label: string;
  type: TargetFieldType;
  operators: NotificationFilterOperator[];
  options?: string[];
};

type TargetRecord = {
  id: number;
  role: NotificationUserRole;
  name: string;
  subtitle: string | null;
  attributes: Record<string, unknown>;
};

const FIELD_OPERATORS: Record<TargetFieldType, NotificationFilterOperator[]> = {
  string: ["eq", "neq", "contains", "in", "not_in", "is_null", "not_null"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "is_null", "not_null"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "is_null", "not_null"],
  enum: ["eq", "neq", "in", "not_in", "is_null", "not_null"],
};

const TARGETING_FIELDS: Record<NotificationUserRole, TargetFieldMetadata[]> = {
  client: [
    { key: "name", label: "الاسم", type: "string", operators: FIELD_OPERATORS.string },
    { key: "mobile", label: "الجوال", type: "string", operators: FIELD_OPERATORS.string },
    { key: "createdAt", label: "تاريخ الإنشاء", type: "date", operators: FIELD_OPERATORS.date },
  ],
  driver: [
    { key: "name", label: "الاسم", type: "string", operators: FIELD_OPERATORS.string },
    { key: "mobile", label: "الجوال", type: "string", operators: FIELD_OPERATORS.string },
    {
      key: "status",
      label: "الحالة",
      type: "enum",
      operators: FIELD_OPERATORS.enum,
      options: ["ACTIVE", "BLOCKED", "DELETED"],
    },
    { key: "carType", label: "نوع المركبة", type: "string", operators: FIELD_OPERATORS.string },
    { key: "nationality", label: "الجنسية", type: "string", operators: FIELD_OPERATORS.string },
    { key: "age", label: "العمر", type: "number", operators: FIELD_OPERATORS.number },
    { key: "warningCount", label: "عدد التحذيرات", type: "number", operators: FIELD_OPERATORS.number },
    { key: "createdAt", label: "تاريخ الإنشاء", type: "date", operators: FIELD_OPERATORS.date },
  ],
  admin: [
    { key: "name", label: "الاسم", type: "string", operators: FIELD_OPERATORS.string },
    { key: "createdAt", label: "تاريخ الإنشاء", type: "date", operators: FIELD_OPERATORS.date },
  ],
};

function normalizeScalar(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim().toLowerCase();
}

function toComparableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.getTime();
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function matchFilterValue(recordValue: unknown, filter: NotificationFilter): boolean {
  if (filter.operator === "is_null") return recordValue == null || recordValue === "";
  if (filter.operator === "not_null") return !(recordValue == null || recordValue === "");

  if (recordValue == null) return false;

  const normalizedRecord = normalizeScalar(recordValue);

  if (filter.operator === "contains") {
    return normalizedRecord.includes(normalizeScalar(filter.value));
  }

  if (filter.operator === "eq") {
    return normalizedRecord === normalizeScalar(filter.value);
  }

  if (filter.operator === "neq") {
    return normalizedRecord !== normalizeScalar(filter.value);
  }

  if (filter.operator === "in" || filter.operator === "not_in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    const matched = values.some((value) => normalizedRecord === normalizeScalar(value));
    return filter.operator === "in" ? matched : !matched;
  }

  const recordNumber = toComparableNumber(recordValue);
  const filterNumber = toComparableNumber(filter.value);
  if (recordNumber == null || filterNumber == null) return false;

  switch (filter.operator) {
    case "gt":
      return recordNumber > filterNumber;
    case "gte":
      return recordNumber >= filterNumber;
    case "lt":
      return recordNumber < filterNumber;
    case "lte":
      return recordNumber <= filterNumber;
    default:
      return false;
  }
}

function isSupportedField(role: NotificationUserRole, field: string): boolean {
  return TARGETING_FIELDS[role].some((candidate) => candidate.key === field);
}

function matchesFilters(record: TargetRecord, filters: NotificationFilter[]): boolean {
  return filters.every((filter) => {
    if (!isSupportedField(record.role, filter.field)) return false;
    return matchFilterValue(record.attributes[filter.field], filter);
  });
}

async function loadClients(): Promise<TargetRecord[]> {
  const rows = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      mobile: clientsTable.mobile,
      createdAt: clientsTable.createdAt,
    })
    .from(clientsTable);

  return rows.map((row) => ({
    id: row.id,
    role: "client",
    name: row.name,
    subtitle: row.mobile,
    attributes: {
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      createdAt: row.createdAt?.toISOString() ?? null,
    },
  }));
}

async function loadDrivers(): Promise<TargetRecord[]> {
  const rows = await db
    .select({
      id: driversTable.id,
      name: driversTable.name,
      mobile: driversTable.mobile,
      status: driversTable.status,
      carType: driversTable.carType,
      nationality: driversTable.nationality,
      age: driversTable.age,
      warningCount: driversTable.warningCount,
      createdAt: driversTable.createdAt,
    })
    .from(driversTable);

  return rows.map((row) => ({
    id: row.id,
    role: "driver",
    name: row.name,
    subtitle: row.mobile,
    attributes: {
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      status: row.status,
      carType: row.carType,
      nationality: row.nationality,
      age: row.age,
      warningCount: row.warningCount,
      createdAt: row.createdAt?.toISOString() ?? null,
    },
  }));
}

async function loadAdmins(): Promise<TargetRecord[]> {
  const rows = await db
    .select({
      id: adminsTable.id,
      name: adminsTable.name,
      createdAt: adminsTable.createdAt,
    })
    .from(adminsTable);

  return rows.map((row) => ({
    id: row.id,
    role: "admin",
    name: row.name,
    subtitle: null,
    attributes: {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt?.toISOString() ?? null,
    },
  }));
}

const LOADERS: Record<NotificationUserRole, () => Promise<TargetRecord[]>> = {
  client: loadClients,
  driver: loadDrivers,
  admin: loadAdmins,
};

export async function getNotificationTargetingMetadata() {
  const [clients, drivers, admins] = await Promise.all([
    loadClients(),
    loadDrivers(),
    loadAdmins(),
  ]);

  return {
    roles: [
      { value: "client" as const, label: "عميل", count: clients.length },
      { value: "driver" as const, label: "سائق", count: drivers.length },
      { value: "admin" as const, label: "مشرف", count: admins.length },
    ],
    fieldsByRole: TARGETING_FIELDS,
    users: [...clients, ...drivers, ...admins].map((record) => ({
      id: record.id,
      role: record.role,
      name: record.name,
      subtitle: record.subtitle,
    })),
  };
}

export async function resolveNotificationRecipients(audience: NotificationAudience) {
  if (audience.mode === "all") {
    const [clients, drivers, admins] = await Promise.all([
      loadClients(),
      loadDrivers(),
      loadAdmins(),
    ]);
    return [...clients, ...drivers, ...admins];
  }

  if (audience.mode === "roles") {
    const groups = await Promise.all(audience.roles.map((role) => LOADERS[role]()));
    return groups.flat();
  }

  if (audience.mode === "user") {
    const users = await LOADERS[audience.userRole]();
    return users.filter((user) => user.id === audience.userId);
  }

  const segments = await Promise.all(
    audience.segments.map(async (segment) => {
      const users = await LOADERS[segment.role]();
      return users.filter((user) => matchesFilters(user, segment.filters));
    })
  );

  const deduped = new Map<string, TargetRecord>();
  for (const user of segments.flat()) {
    deduped.set(`${user.role}:${user.id}`, user);
  }
  return Array.from(deduped.values());
}

export async function ensureNotificationUserExists(userId: number, userRole: NotificationUserRole) {
  if (userRole === "client") {
    const row = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, userId) });
    return Boolean(row);
  }
  if (userRole === "driver") {
    const row = await db.query.driversTable.findFirst({ where: eq(driversTable.id, userId) });
    return Boolean(row);
  }
  const row = await db.query.adminsTable.findFirst({ where: eq(adminsTable.id, userId) });
  return Boolean(row);
}
