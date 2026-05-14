-- Migration: Add password-based authentication for admins
-- Date: 2026-05-14
-- Description: Adds email and password fields to support secure password-based auth
--              while maintaining backward compatibility with loginCode

-- Add email column for password-based login
ALTER TABLE admins ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Add password column for scrypt hashed passwords
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password TEXT;

-- Make loginCode nullable for transition (was NOT NULL)
ALTER TABLE admins ALTER COLUMN login_code DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN admins.email IS 'Email address for password-based authentication';
COMMENT ON COLUMN admins.password IS 'Scrypt hashed password (replaces loginCode for better security)';
COMMENT ON COLUMN admins.login_code IS 'Deprecated - kept for backward compatibility during transition';

-- Note: Existing admins will continue to use loginCode until migrated to email+password
