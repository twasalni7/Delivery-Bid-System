-- =====================================================================
-- Migration 023: Rename pricing_matrix columns to match Drizzle schema
-- نظام توصّلني — تصحيح أسماء أعمدة pricing_matrix
-- =====================================================================
--
-- السبب: مهاجرة 010 أنشأت الجدول بأعمدة:
--   min_km, max_km, num_passengers
-- بينما سكيمة Drizzle تتوقع:
--   distance_min_km, distance_max_km, passengers_min
-- هذا التعارض يتسبب في أخطاء "column does not exist" في الكود.
--
-- هذه المهاجرة تصحح الأسماء وتعيد بناء الفهرس الفريد.
-- تعمل بشكل آمن سواء كانت الأعمدة بالأسماء القديمة أو الجديدة.
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/023_pricing_matrix_rename_columns.sql
-- Or paste into Supabase SQL Editor
-- =====================================================================

DO $$
BEGIN
  -- ─── Rename min_km → distance_min_km ─────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'pricing_matrix'
      AND column_name  = 'min_km'
  ) THEN
    ALTER TABLE public.pricing_matrix RENAME COLUMN min_km TO distance_min_km;
  END IF;

  -- ─── Rename max_km → distance_max_km ─────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'pricing_matrix'
      AND column_name  = 'max_km'
  ) THEN
    ALTER TABLE public.pricing_matrix RENAME COLUMN max_km TO distance_max_km;
  END IF;

  -- ─── Rename num_passengers → passengers_min ───────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'pricing_matrix'
      AND column_name  = 'num_passengers'
  ) THEN
    ALTER TABLE public.pricing_matrix RENAME COLUMN num_passengers TO passengers_min;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- Recreate unique index with new column names
-- (The old index pricing_matrix_unique_idx may reference old names)
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS pricing_matrix_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pricing_matrix_unique_idx
  ON public.pricing_matrix (distance_min_km, distance_max_km, passengers_min);

-- ─────────────────────────────────────────────────────────────────────
-- Add extra columns used by the Drizzle schema (idempotent)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.pricing_matrix
  ADD COLUMN IF NOT EXISTS trip_type         TEXT,
  ADD COLUMN IF NOT EXISTS days_per_week_min INTEGER,
  ADD COLUMN IF NOT EXISTS days_per_week_max INTEGER;

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'pricing_matrix'
-- ORDER BY ordinal_position;
