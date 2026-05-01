-- =====================================================================
-- Migration 007: Add coordinate and pricing fields to requests table
-- نظام توصّلني — إضافة حقول الإحداثيات والتسعير التلقائي
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/007_pricing_and_coordinates.sql
-- Or paste into Supabase SQL Editor
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- الأهداف:
--   1. إضافة حقول الإحداثيات (latitude/longitude) للموقع المنزلي والوجهة
--   2. إضافة حقل المسافة المحسوبة (distance_km)
--   3. إضافة علامة needs_admin_review للطلبات التي تتجاوز 40 كم
--   4. إنشاء فهرس للطلبات التي تحتاج مراجعة الإدارة
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add coordinate and pricing fields
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS home_lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lng           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km        REAL,
  ADD COLUMN IF NOT EXISTS needs_admin_review BOOLEAN NOT NULL DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Add column comments for documentation
-- ─────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.requests.home_lat IS
  'Home location latitude (WGS84)';

COMMENT ON COLUMN public.requests.home_lng IS
  'Home location longitude (WGS84)';

COMMENT ON COLUMN public.requests.dest_lat IS
  'Destination latitude (WGS84)';

COMMENT ON COLUMN public.requests.dest_lng IS
  'Destination longitude (WGS84)';

COMMENT ON COLUMN public.requests.distance_km IS
  'Straight-line distance in km (Haversine)';

COMMENT ON COLUMN public.requests.needs_admin_review IS
  'True when distance > 40 km — admin must approve before drivers can see the request';


-- ─────────────────────────────────────────────────────────────────────
-- 3. Create index for admin review queries
-- ─────────────────────────────────────────────────────────────────────
-- Index to let admin quickly find requests awaiting review
CREATE INDEX IF NOT EXISTS idx_requests_needs_review
  ON public.requests (needs_admin_review)
  WHERE needs_admin_review = TRUE;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check columns were added:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'requests'
--      AND column_name IN ('home_lat', 'home_lng', 'dest_lat', 'dest_lng', 'distance_km', 'needs_admin_review');
--
-- Check index was created:
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public'
--      AND tablename = 'requests'
--      AND indexname = 'idx_requests_needs_review';
