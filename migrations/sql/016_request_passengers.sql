-- =====================================================================
-- Migration 016: Create request_passengers table
-- نظام توصّلني — جدول بيانات الركاب لكل طلب
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/016_request_passengers.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. إنشاء جدول request_passengers لتخزين بيانات كل راكب على حدة
--   2. يتيح حفظ إحداثيات المنزل والعمل لكل راكب
--   3. يتيح حساب مسافة كل راكب وتوقيت دوامه
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Create the request_passengers table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.request_passengers (
  id                SERIAL PRIMARY KEY,
  request_id        INTEGER NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  passenger_index   INTEGER NOT NULL,
  pickup_lat        DOUBLE PRECISION,
  pickup_lng        DOUBLE PRECISION,
  destination_lat   DOUBLE PRECISION,
  destination_lng   DOUBLE PRECISION,
  pickup_address    TEXT,
  destination_address TEXT,
  work_time         TEXT,
  days_per_week     INTEGER,
  distance_km       REAL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT request_passengers_index_check CHECK (passenger_index >= 1)
);

-- Index for efficient lookup by request
CREATE INDEX IF NOT EXISTS request_passengers_request_id_idx
  ON public.request_passengers (request_id);

-- Unique: one row per passenger per request
CREATE UNIQUE INDEX IF NOT EXISTS request_passengers_unique_idx
  ON public.request_passengers (request_id, passenger_index);


-- ─────────────────────────────────────────────────────────────────────
-- 2. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.request_passengers ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the API server)
-- Note: CREATE POLICY does not support IF NOT EXISTS, so we guard via DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'request_passengers'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON public.request_passengers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT * FROM public.request_passengers LIMIT 10;
