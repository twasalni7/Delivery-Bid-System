-- =====================================================
-- Migration: Add driver self-registration system
-- Added in PRs #196, #197, #198
-- Run this against any database that was created from
-- full_schema.sql before these columns/tables existed.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. Add missing columns to drivers table
-- ─────────────────────────────────────────────────────

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_year TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS requires_password_reset INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────
-- 2. Create password_reset_tokens table
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 3. Create registration_request_status enum
-- ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_request_status') THEN
    CREATE TYPE registration_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────
-- 4. Create driver_registration_requests table
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_registration_requests (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  mobile            TEXT NOT NULL,
  city              TEXT NOT NULL,
  car_type          TEXT NOT NULL,
  car_year          TEXT NOT NULL,
  nationality       TEXT NOT NULL,
  national_id       TEXT NOT NULL,
  age               INTEGER NOT NULL,
  status            registration_request_status NOT NULL DEFAULT 'PENDING',
  approved_by       INTEGER REFERENCES admins(id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_driver_id INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 5. Indexes for driver_registration_requests
-- ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_mobile
  ON driver_registration_requests(mobile);

CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_status
  ON driver_registration_requests(status);

CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_created_at
  ON driver_registration_requests(created_at);
