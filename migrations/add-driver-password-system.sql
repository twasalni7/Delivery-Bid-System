-- Migration: Add Password System for Drivers
-- Date: 2026-05-31
-- Description: Updates driver authentication to support password-based login

-- ========================================
-- 1. Add new columns to drivers table
-- ========================================

-- Add password hash column (nullable for backward compatibility with existing drivers)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add flag to require password reset (0 = false, 1 = true)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS requires_password_reset INTEGER NOT NULL DEFAULT 0;

-- Add car year column
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_year TEXT;

-- Add city column
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city TEXT;

-- ========================================
-- 2. Create password_reset_tokens table
-- ========================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_driver_id ON password_reset_tokens(driver_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

-- ========================================
-- 3. Create driver_registration_requests table
-- ========================================

-- Create enum for request status
DO $$ BEGIN
  CREATE TYPE registration_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS driver_registration_requests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  city TEXT NOT NULL,
  car_type TEXT NOT NULL,
  car_year TEXT NOT NULL,
  nationality TEXT NOT NULL,
  national_id TEXT NOT NULL,
  age INTEGER NOT NULL,
  status registration_request_status NOT NULL DEFAULT 'PENDING',
  approved_by INTEGER REFERENCES admins(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_driver_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_mobile ON driver_registration_requests(mobile);
CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_status ON driver_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_driver_registration_requests_created_at ON driver_registration_requests(created_at);

-- ========================================
-- Migration Notes:
-- ========================================
--
-- 1. Existing drivers will have password_hash = NULL
--    - They can still login with loginCode
--    - On first login, they will be prompted to set a password
--
-- 2. New drivers created by admin will have:
--    - Both loginCode and temporary password
--    - requires_password_reset = 1 (must change password on first login)
--
-- 3. Password reset tokens expire after 15 minutes
--
-- 4. Driver registration requests allow new drivers to apply
--    - Admin can approve/reject requests
--    - On approval, a driver account is automatically created
--
-- ========================================
-- ROLLBACK (if needed):
-- ========================================
--
-- DROP TABLE IF EXISTS driver_registration_requests;
-- DROP TYPE IF EXISTS registration_request_status;
-- DROP TABLE IF EXISTS password_reset_tokens;
-- ALTER TABLE drivers DROP COLUMN IF EXISTS city;
-- ALTER TABLE drivers DROP COLUMN IF EXISTS car_year;
-- ALTER TABLE drivers DROP COLUMN IF EXISTS requires_password_reset;
-- ALTER TABLE drivers DROP COLUMN IF EXISTS password_hash;
