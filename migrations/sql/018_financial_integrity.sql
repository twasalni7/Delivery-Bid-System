-- =====================================================================
-- Migration 018 — Financial integrity + type correctness fixes
--
-- 1. Monetary columns: real (float4) → numeric(12,2) so no floating-point
--    rounding ever occurs on money values (balance, amounts, monthly price).
-- 2. Distance columns: real → double precision (float8) for better precision.
-- 3. system_alerts.is_read and system_errors.resolved: TEXT → BOOLEAN so
--    JavaScript truthiness (non-empty string == true) is no longer a trap.
-- 4. wallet_transactions.int_id: introduce a real PostgreSQL SEQUENCE so
--    concurrent inserts never race on MAX(int_id)+1.
-- =====================================================================

-- ── 1. drivers.balance  ───────────────────────────────────────────────────────
ALTER TABLE drivers
  ALTER COLUMN balance TYPE NUMERIC(12,2)
    USING balance::NUMERIC(12,2);

ALTER TABLE drivers
  ALTER COLUMN balance SET DEFAULT 0;

-- ── 2. transactions.amount  ───────────────────────────────────────────────────
ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(12,2)
    USING amount::NUMERIC(12,2);

-- ── 3. requests.monthly_price  ────────────────────────────────────────────────
ALTER TABLE requests
  ALTER COLUMN monthly_price TYPE NUMERIC(12,2)
    USING monthly_price::NUMERIC(12,2);

ALTER TABLE requests
  ALTER COLUMN monthly_price SET DEFAULT 0;

-- ── 4. requests.distance_km  ──────────────────────────────────────────────────
ALTER TABLE requests
  ALTER COLUMN distance_km TYPE DOUBLE PRECISION
    USING distance_km::DOUBLE PRECISION;

-- ── 5. request_passengers.distance_km  ───────────────────────────────────────
ALTER TABLE request_passengers
  ALTER COLUMN distance_km TYPE DOUBLE PRECISION
    USING distance_km::DOUBLE PRECISION;

-- ── 6. system_alerts.is_read  ─────────────────────────────────────────────────
ALTER TABLE system_alerts
  ALTER COLUMN is_read TYPE BOOLEAN
    USING (is_read = 'true');

ALTER TABLE system_alerts
  ALTER COLUMN is_read SET DEFAULT FALSE;

-- ── 7. system_errors.resolved  ────────────────────────────────────────────────
ALTER TABLE system_errors
  ALTER COLUMN resolved TYPE BOOLEAN
    USING (resolved = 'true');

ALTER TABLE system_errors
  ALTER COLUMN resolved SET DEFAULT FALSE;

-- ── 8. wallet_transactions.int_id sequence  ───────────────────────────────────
-- Creates a proper sequence so concurrent POST /wallet-transactions requests
-- never collide on a MAX+1 read-modify-write.
CREATE SEQUENCE IF NOT EXISTS wallet_transactions_int_id_seq;

-- Seed the sequence to the current maximum so existing rows are not duplicated.
SELECT setval(
  'wallet_transactions_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM wallet_transactions), 0)
);

-- Wire the default; existing rows keep their values.
ALTER TABLE wallet_transactions
  ALTER COLUMN int_id SET DEFAULT nextval('wallet_transactions_int_id_seq');
