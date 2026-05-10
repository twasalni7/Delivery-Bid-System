-- Migration: unique constraint on offers (driver_id, request_id) for active offers
-- Prevents race condition: duplicate bids from rapid double-clicks
-- Uses partial unique index (only on PENDING and SELECTED statuses)

CREATE UNIQUE INDEX IF NOT EXISTS offers_driver_request_active_unique
  ON offers (driver_id, request_id)
  WHERE status IN ('PENDING', 'SELECTED');

-- Comment: CANCELLED offers allow re-bidding (excluded from unique constraint)

