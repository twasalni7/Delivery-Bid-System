-- =====================================================
-- Migration: Add int_id to wallet_transactions and bank_accounts
--            Add account_number (nullable) to bank_accounts
-- Run this on existing Supabase databases that already have these tables.
-- =====================================================

-- Add int_id to wallet_transactions (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' AND column_name = 'int_id'
  ) THEN
    ALTER TABLE wallet_transactions
      ADD COLUMN int_id INTEGER GENERATED ALWAYS AS IDENTITY UNIQUE;
  END IF;
END $$;

-- Add int_id to bank_accounts (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'int_id'
  ) THEN
    ALTER TABLE bank_accounts
      ADD COLUMN int_id INTEGER GENERATED ALWAYS AS IDENTITY UNIQUE;
  END IF;
END $$;

-- Add account_number (nullable) to bank_accounts (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE bank_accounts
      ADD COLUMN account_number TEXT;
  END IF;
END $$;
