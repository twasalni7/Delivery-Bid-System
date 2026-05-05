-- =====================================================================
-- Migration 020 — push_subscriptions: add user_role + upsert support
-- =====================================================================
-- Adds user_role column and a unique constraint on (user_id, user_role)
-- so that each user/role combination has exactly one push subscription
-- and we can do INSERT … ON CONFLICT DO UPDATE (upsert).
-- =====================================================================

-- 1. Add user_role column (idempotent)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'client';

-- Remove the default after adding (the column must be NOT NULL but we
-- don't want a permanent default on new rows).
ALTER TABLE push_subscriptions
  ALTER COLUMN user_role DROP DEFAULT;

-- 2. Add unique index on (user_id, user_role) for upsert support.
--    Use a DO block so it is idempotent (IF NOT EXISTS is not available
--    for CREATE UNIQUE INDEX in older Postgres versions).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  tablename  = 'push_subscriptions'
    AND    indexname  = 'push_subscriptions_user_role_unique'
  ) THEN
    CREATE UNIQUE INDEX push_subscriptions_user_role_unique
      ON push_subscriptions (user_id, user_role);
  END IF;
END$$;
