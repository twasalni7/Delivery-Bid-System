-- =====================================================================
-- Migration 011: Add price_sar and passengers_max to pricing_matrix
-- نظام توصّلني — إضافة عمود السعر الإجمالي والحد الأقصى للركاب
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/011_pricing_matrix_price_sar.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. إضافة عمود price_sar (السعر الإجمالي للمسار)
--   2. إضافة عمود passengers_max (الحد الأقصى لعدد الركاب)
--   3. حساب السعر للشخص الواحد ديناميكياً: price_sar / عدد الركاب الفعلي
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add new columns
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.pricing_matrix
  ADD COLUMN IF NOT EXISTS price_sar      REAL,
  ADD COLUMN IF NOT EXISTS passengers_max INTEGER DEFAULT 4;

COMMENT ON COLUMN public.pricing_matrix.price_sar IS
  'Total route price in SAR (base price for 1 passenger). Price per person = price_sar / actual_passengers.';

COMMENT ON COLUMN public.pricing_matrix.passengers_max IS
  'Maximum number of passengers allowed for this distance tier.';


-- ─────────────────────────────────────────────────────────────────────
-- 2. Populate price_sar and passengers_max for 1-passenger rows.
--    The 1-passenger price_per_person IS the total route price for a
--    single occupant — this becomes price_sar (the base route cost).
--    Changing price_sar in the dashboard will automatically update
--    the displayed per-person price for any number of passengers.
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.pricing_matrix
SET
  price_sar      = price_per_person,
  passengers_max = 4
WHERE num_passengers = 1;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT min_km, max_km, num_passengers, price_per_person, price_sar, passengers_max
--   FROM public.pricing_matrix
--  WHERE num_passengers = 1
--  ORDER BY min_km;
