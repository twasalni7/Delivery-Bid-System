export function hasArchivedTimestamp(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (!("archivedAt" in value)) return false;
  const archivedAt = (value as { archivedAt?: unknown }).archivedAt;
  return typeof archivedAt === "string" && archivedAt.length > 0;
}
