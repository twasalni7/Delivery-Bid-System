export type RequestStatus =
  | "OPEN"
  | "SELECTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "FROZEN";

export const ALL_STATUSES: RequestStatus[] = [
  "OPEN", "SELECTED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED", "FROZEN",
];

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: "مفتوح",
    SELECTED: "تم الاختيار",
    ACTIVE: "نشط",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغي",
    EXPIRED: "منتهي",
    FROZEN: "مجمّد",
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-800 border-blue-200",
    SELECTED: "bg-green-100 text-green-800 border-green-200",
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
    EXPIRED: "bg-amber-100 text-amber-800 border-amber-200",
    FROZEN: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return colors[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export function getTicketStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: "مفتوحة",
    IN_PROGRESS: "قيد المعالجة",
    RESOLVED: "تم الحل",
    CLOSED: "مغلقة",
  };
  return labels[status] ?? status;
}

export function getTicketStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-800 border-blue-200",
    IN_PROGRESS: "bg-orange-100 text-orange-800 border-orange-200",
    RESOLVED: "bg-green-100 text-green-800 border-green-200",
    CLOSED: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return colors[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
}
