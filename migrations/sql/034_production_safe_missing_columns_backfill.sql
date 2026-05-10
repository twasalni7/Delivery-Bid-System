-- =====================================================================
-- Migration 034 — Production-safe backfill for missing columns
-- Purpose: add only missing columns required by current API/server code.
-- Safe: idempotent (IF NOT EXISTS), no table recreation, no data deletion.
-- =====================================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS duration_minutes double precision,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamp,
  ADD COLUMN IF NOT EXISTS status_manually_set_by_admin boolean;

UPDATE requests
SET status_manually_set_by_admin = false
WHERE status_manually_set_by_admin IS NULL;

ALTER TABLE requests
  ALTER COLUMN status_manually_set_by_admin SET DEFAULT false;

ALTER TABLE requests
  ALTER COLUMN status_manually_set_by_admin SET NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamp,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_payload jsonb,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp,
  ADD COLUMN IF NOT EXISTS clicked_at timestamp,
  ADD COLUMN IF NOT EXISTS interacted_at timestamp,
  ADD COLUMN IF NOT EXISTS interaction_source text,
  ADD COLUMN IF NOT EXISTS interaction_type text,
  ADD COLUMN IF NOT EXISTS url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_channel_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_channel_check
      CHECK (channel IN ('in_app', 'push'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_delivery_status_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_delivery_status_check
      CHECK (delivery_status IN ('pending', 'delivered', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON notifications(read_at);

CREATE INDEX IF NOT EXISTS notifications_interacted_at_idx
  ON notifications(interacted_at);

CREATE INDEX IF NOT EXISTS notifications_user_role_created_idx
  ON notifications(user_role, user_id, created_at DESC);
