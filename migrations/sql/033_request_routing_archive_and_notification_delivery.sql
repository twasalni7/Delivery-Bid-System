ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS duration_minutes double precision,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamp;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;
