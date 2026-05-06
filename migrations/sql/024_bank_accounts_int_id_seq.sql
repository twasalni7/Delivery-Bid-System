-- =====================================================================
-- Migration 024: Add sequence for bank_accounts.int_id
-- نظام توصّلني — تحويل bank_accounts.int_id إلى sequence آمن
-- =====================================================================
--
-- السبب: الكود السابق كان يحسب int_id بطريقة MAX+1 داخل SELECT
-- وهي غير آمنة عند الطلبات المتزامنة (race condition).
-- الحل: إنشاء sequence تضمن قيماً فريدة تحت أي ضغط.
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/024_bank_accounts_int_id_seq.sql
-- Or paste into Supabase SQL Editor
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Create the sequence (idempotent)
-- ─────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS bank_accounts_int_id_seq;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Seed the sequence to the current maximum so existing rows
--    are not duplicated.
-- ─────────────────────────────────────────────────────────────────────
SELECT setval(
  'bank_accounts_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM bank_accounts), 0)
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Wire the sequence as the column default.
--    Existing rows keep their current values.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE bank_accounts
  ALTER COLUMN int_id SET DEFAULT nextval('bank_accounts_int_id_seq');

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT last_value FROM bank_accounts_int_id_seq;
-- SELECT int_id FROM bank_accounts ORDER BY int_id DESC LIMIT 5;
