-- =====================================================================
-- Migration 028 — Missing performance indexes (no code changes)
-- المرحلة 2: الفهارس والأداء
-- =====================================================================
-- Adds indexes used by high-traffic admin/operations/push queries.
-- All indexes are idempotent via IF NOT EXISTS.

-- ── operations: unresolved errors and alerts streams ───────────────────
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved_created
  ON system_errors (resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_errors_severity_created
  ON system_errors (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_errors_open_dedupe
  ON system_errors (error_type, message, created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_system_alerts_unread_created
  ON system_alerts (is_read, created_at DESC);

-- ── admin recent-events feeds ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status_created
  ON wallet_transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_status_created
  ON offers (status, created_at DESC);

-- ── push debug / monitor role aggregation ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_role
  ON push_subscriptions (user_role);
