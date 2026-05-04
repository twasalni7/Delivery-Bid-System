-- =====================================================================
-- Migration 017 — Notification tracking fields
-- Adds delivered_at, clicked_at, and url columns to the notifications table.
-- =====================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS url         TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ;

-- Index for analytics queries (count delivered / clicked per time range)
CREATE INDEX IF NOT EXISTS idx_notifications_delivered_at
  ON notifications (delivered_at)
  WHERE delivered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_clicked_at
  ON notifications (clicked_at)
  WHERE clicked_at IS NOT NULL;

-- Index used by the cleanup job (stale subscription detection)
CREATE INDEX IF NOT EXISTS idx_notifications_user_delivered
  ON notifications (user_id, user_role, delivered_at);
