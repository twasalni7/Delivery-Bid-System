-- Migration: Add UNIQUE constraint to prevent duplicate offers
-- Date: 2026-05-14
-- Description: Prevents a driver from creating multiple active offers for the same request
--              Uses partial unique index to only apply to PENDING and SELECTED statuses

-- Add partial unique index to prevent duplicate active offers
-- This ensures a driver can only have ONE active offer (PENDING or SELECTED) per request
CREATE UNIQUE INDEX IF NOT EXISTS offers_driver_request_active_unique
ON offers (driver_id, request_id)
WHERE status IN ('PENDING', 'SELECTED');

-- Add comment for clarity
COMMENT ON INDEX offers_driver_request_active_unique IS
'Prevents duplicate active offers: a driver can only have one PENDING or SELECTED offer per request';

-- Note: CANCELLED offers are excluded from uniqueness to allow drivers to re-bid
-- Note: This index will cause INSERT conflicts that should be handled gracefully in application code
