-- 013_user_tokens.sql
-- Persistent auth tokens stored in localStorage on clients (replaces cookie-based sessions)

CREATE TABLE IF NOT EXISTS user_tokens (
  token       TEXT PRIMARY KEY CHECK (length(token) = 64),
  user_id     INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
  name        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at ON user_tokens (expires_at);

-- Clean up expired tokens automatically (requires pg_cron or periodic job;
-- this function can be called manually or via a scheduled task)
CREATE OR REPLACE FUNCTION delete_expired_user_tokens() RETURNS void AS $$
  DELETE FROM user_tokens WHERE expires_at < now();
$$ LANGUAGE SQL;
