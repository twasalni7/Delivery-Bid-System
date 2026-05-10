-- =====================================================================
-- Migration 030 — Add transaction_type enum to transactions table
--
-- Context: transactions.type was a free-text column, allowing any string.
-- This migration:
--   1. Creates the transaction_type enum (fee, credit, debit)
--   2. Migrates the existing TEXT column to use the new enum
--   3. Idempotent — safe to re-run
-- =====================================================================

-- Step 1: Create the enum type (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'transaction_type'
  ) THEN
    CREATE TYPE public.transaction_type AS ENUM ('fee', 'credit', 'debit');
  END IF;
END $$;

-- Step 2: Alter the column to use the enum
-- Uses USING cast — existing values 'fee', 'credit', 'debit' map directly
ALTER TABLE public.transactions
  ALTER COLUMN type TYPE public.transaction_type
    USING type::public.transaction_type;

-- Step 3: Ensure NOT NULL constraint is in place
ALTER TABLE public.transactions
  ALTER COLUMN type SET NOT NULL;
