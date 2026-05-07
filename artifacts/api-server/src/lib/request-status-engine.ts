import { logger } from "./logger";

/**
 * Centralised request-status transition engine.
 *
 * Design constraints
 * ------------------
 * The current system does NOT store an explicit trip-start date, trip-end date,
 * or expiry timestamp on each request row.  Without these reliable signals,
 * auto-transitioning the following statuses would require inventing new
 * business logic that does not yet exist in the codebase:
 *
 *   SELECTED → ACTIVE   (when does the driver officially start the trip?)
 *   ACTIVE   → COMPLETED (when is the trip considered done?)
 *   ACTIVE   → EXPIRED   (how long before we expire an unstarted trip?)
 *   any      → CANCELLED (who cancels, and under what conditions?)
 *
 * These four statuses are therefore LOCKED — the engine will not change them
 * automatically.  When the product team defines explicit events/timestamps for
 * these transitions, the corresponding event types should be added to
 * ResolveRequestStatusInput["event"] and handled before the LOCKED_STATUSES
 * guard below.
 */
export type RequestStatus =
  | "OPEN"
  | "SELECTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "FROZEN";

export interface ResolveRequestStatusInput {
  currentStatus: RequestStatus;
  selectedDriverId: number | null | undefined;
  needsAdminReview: boolean | null | undefined;
  event:
    | "request_created"
    | "offer_selected"
    | "selected_driver_assigned"
    | "admin_request_updated"
    | "manual_status_sync_requested"
    | "background_sync";
}

// See module-level JSDoc above for why these statuses are locked.
const LOCKED_STATUSES = new Set<RequestStatus>([
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

export function resolveRequestStatus(input: ResolveRequestStatusInput): {
  status: RequestStatus;
  reason: string;
} {
  if (input.event === "offer_selected" || input.event === "selected_driver_assigned") {
    return {
      status: "SELECTED",
      reason: "driver_selected_event",
    };
  }

  if (input.event === "request_created") {
    if (input.selectedDriverId != null) {
      return { status: "SELECTED", reason: "created_with_selected_driver" };
    }
    if (Boolean(input.needsAdminReview)) {
      return { status: "FROZEN", reason: "created_with_admin_review_required" };
    }
    return { status: "OPEN", reason: "created_without_selected_driver_or_review" };
  }

  if (LOCKED_STATUSES.has(input.currentStatus)) {
    return { status: input.currentStatus, reason: "status_locked_without_transition_signal" };
  }

  if (input.selectedDriverId != null) {
    return { status: "SELECTED", reason: "selected_driver_present" };
  }
  if (Boolean(input.needsAdminReview)) {
    return { status: "FROZEN", reason: "admin_review_required" };
  }
  return { status: "OPEN", reason: "default_open_state" };
}

export function logRequestStatusTransition(params: {
  requestId: number;
  previousStatus: RequestStatus;
  nextStatus: RequestStatus;
  reason: string;
  event: ResolveRequestStatusInput["event"];
}): void {
  if (params.previousStatus === params.nextStatus) return;
  logger.info(
    {
      requestId: params.requestId,
      previousStatus: params.previousStatus,
      nextStatus: params.nextStatus,
      reason: params.reason,
      event: params.event,
    },
    "request status transition",
  );
}
