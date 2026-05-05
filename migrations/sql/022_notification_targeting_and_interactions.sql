ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS action_payload JSONB,
  ADD COLUMN IF NOT EXISTS interacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS interaction_source TEXT,
  ADD COLUMN IF NOT EXISTS interaction_type TEXT;

CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON notifications(read_at);

CREATE INDEX IF NOT EXISTS notifications_interacted_at_idx
  ON notifications(interacted_at);

CREATE INDEX IF NOT EXISTS notifications_user_role_created_idx
  ON notifications(user_role, user_id, created_at DESC);
