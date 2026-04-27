-- =====================================================================
-- Migration 002 — Performance Indexes & Data-Integrity Constraints
-- نظام توصّلني — الفهارس والقيود
-- =====================================================================
--
-- ⚠️  تحذير: راجع الأسماء على schema الفعلي، وشغّل على staging أولاً.
--            أخذ نسخة احتياطية قبل التنفيذ.
--
-- Note: FK constraints referencing drivers(id) and clients(id) already
-- exist in the schema DDL (full_schema.sql).  This file adds missing
-- performance indexes and the partial-unique guard index.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Performance indexes
-- ─────────────────────────────────────────────────────────────────────

-- requests: filter/sort by client and status
CREATE INDEX IF NOT EXISTS idx_requests_client_id
  ON requests (client_id);

CREATE INDEX IF NOT EXISTS idx_requests_status_created
  ON requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_selected_driver
  ON requests (selected_driver_id)
  WHERE selected_driver_id IS NOT NULL;

-- offers: look up offers by request or driver
CREATE INDEX IF NOT EXISTS idx_offers_request_id
  ON offers (request_id);

CREATE INDEX IF NOT EXISTS idx_offers_driver_id
  ON offers (driver_id);

-- notifications: user inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, user_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, user_role, is_read)
  WHERE is_read = false;

-- transactions: driver statement queries
CREATE INDEX IF NOT EXISTS idx_transactions_driver_id
  ON transactions (driver_id, created_at DESC);

-- wallet_transactions: driver wallet history
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_driver_id
  ON wallet_transactions (driver_id, created_at DESC);

-- support_tickets: lookup by client or driver
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_id
  ON support_tickets (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_driver_id
  ON support_tickets (driver_id)
  WHERE driver_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Prevent duplicate accepted offers per request
--    (partial unique index: only one SELECTED offer allowed per request)
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS unique_request_selected_offer
  ON offers (request_id)
  WHERE status = 'SELECTED';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Prevent duplicate pending offers from the same driver per request
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS unique_driver_request_pending_offer
  ON offers (driver_id, request_id)
  WHERE status = 'PENDING';

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
