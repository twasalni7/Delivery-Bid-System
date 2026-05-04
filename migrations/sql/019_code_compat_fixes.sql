-- =====================================================================
-- Migration 019 — Code-compatibility fixes (post-018)
--
-- Context: Migration 018 altered system_errors.resolved and
-- system_alerts.is_read from TEXT → BOOLEAN, but the application code
-- was still using string literals ("true"/"false") to compare/set those
-- columns.  This migration is a no-op on the DB itself (the schema is
-- already correct after 018) but documents the required code changes
-- and adds a useful covering index for offer-status queries.
--
-- DB changes in this file:
--   1. Add index on offers(status) — used by soft-delete queries that
--      filter by status = 'CANCELLED'.
--   2. Ensure wallet_transactions_int_id_seq exists and its DEFAULT is
--      wired to the column (idempotent repeat of 018 for safety).
-- =====================================================================

-- ── 1. Index for offer status queries (soft-delete reads)  ───────────
CREATE INDEX IF NOT EXISTS idx_offers_status
  ON offers (status);

-- ── 2. Idempotent sequence wiring for wallet_transactions.int_id  ─────
-- (Migration 018 already created this sequence; this block is safe to
-- re-run and guards against environments where 018 was only partially
-- applied.)
CREATE SEQUENCE IF NOT EXISTS wallet_transactions_int_id_seq;

SELECT setval(
  'wallet_transactions_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM wallet_transactions), 0)
) WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'wallet_transactions'
    AND column_name = 'int_id'
    AND column_default LIKE '%wallet_transactions_int_id_seq%'
);

ALTER TABLE wallet_transactions
  ALTER COLUMN int_id SET DEFAULT nextval('wallet_transactions_int_id_seq');
