-- =====================================================================
-- Migration 010: Create pricing_matrix table
-- نظام توصّلني — جدول مصفوفة التسعير الديناميكية
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/010_pricing_matrix.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. إنشاء جدول pricing_matrix يحدد سعر الشخص الواحد
--      بناءً على نطاق المسافة وعدد الركاب
--   2. تعبئة الجدول ببيانات أولية مستمدة من نطاقات الأسعار الحالية
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Create the pricing_matrix table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_matrix (
  id             SERIAL PRIMARY KEY,
  min_km         REAL    NOT NULL,
  max_km         REAL    NOT NULL,
  num_passengers INTEGER NOT NULL,
  price_per_person REAL  NOT NULL,
  CONSTRAINT pricing_matrix_range_check CHECK (min_km >= 0 AND max_km > min_km),
  CONSTRAINT pricing_matrix_passengers_check CHECK (num_passengers >= 1),
  CONSTRAINT pricing_matrix_price_check CHECK (price_per_person > 0)
);

-- Unique index: one row per (distance range, passenger count)
CREATE UNIQUE INDEX IF NOT EXISTS pricing_matrix_unique_idx
  ON public.pricing_matrix (min_km, max_km, num_passengers);


-- ─────────────────────────────────────────────────────────────────────
-- 2. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.pricing_matrix ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the API server)
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.pricing_matrix
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 3. Seed initial pricing data
--    Rows represent: (min_km, max_km, num_passengers, price_per_person)
--    Price = base_tier × sharing_factor (one-way baseline, 5 working days)
--
--    Distance tiers: 0-5, 5-10, 10-15, 15-20, 20-25, 25-30, 30-40 km
--    Sharing factors: 1 person=1.0, 2 people=0.72, 3 people=0.60, 4 people=0.52
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.pricing_matrix (min_km, max_km, num_passengers, price_per_person) VALUES
  -- 0–5 km
  (0,  5,  1,  500),
  (0,  5,  2,  360),
  (0,  5,  3,  300),
  (0,  5,  4,  260),
  -- 5–10 km
  (5,  10, 1,  800),
  (5,  10, 2,  576),
  (5,  10, 3,  480),
  (5,  10, 4,  416),
  -- 10–15 km
  (10, 15, 1,  1000),
  (10, 15, 2,  720),
  (10, 15, 3,  600),
  (10, 15, 4,  520),
  -- 15–20 km
  (15, 20, 1,  1200),
  (15, 20, 2,  864),
  (15, 20, 3,  720),
  (15, 20, 4,  624),
  -- 20–25 km
  (20, 25, 1,  1400),
  (20, 25, 2,  1008),
  (20, 25, 3,  840),
  (20, 25, 4,  728),
  -- 25–30 km
  (25, 30, 1,  1700),
  (25, 30, 2,  1224),
  (25, 30, 3,  1020),
  (25, 30, 4,  884),
  -- 30–40 km
  (30, 40, 1,  2200),
  (30, 40, 2,  1584),
  (30, 40, 3,  1320),
  (30, 40, 4,  1144)
ON CONFLICT (min_km, max_km, num_passengers) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT * FROM public.pricing_matrix ORDER BY min_km, num_passengers;
