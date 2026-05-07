-- =====================================================================
-- Migration 025: Seed pricing engine and formula_v2 config keys
-- نظام توصّلني — تهيئة مفاتيح محرك التسعير
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/025_pricing_engine_config.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. تعريف محرك التسعير الافتراضي (matrix = النظام القديم)
--   2. تعطيل المقارنة التظليلية بالافتراضي
--   3. تعريف ثوابت النظام الجديد (formula_v2) كقيم ابتدائية
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Active pricing engine
--    'matrix'     → النظام القديم (pricing_matrix جدول)
--    'formula_v2' → النظام الجديد (المعادلة الجديدة)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('pricing_engine', 'matrix')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Shadow compare flag
--    عند التفعيل يسجّل الفرق بين النظامين دون تغيير النتيجة الفعلية
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('pricing_shadow_compare', 'false')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 3. formula_v2 constants (defaults matching DEFAULT_FORMULA_V2_CONSTANTS)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('pricing_v2_price_per_km', '0.85')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('pricing_v2_visit_fee', '15')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('pricing_v2_extra_location_rate', '0.15')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('pricing_v2_weeks', '4')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT key, value FROM public.app_config
--  WHERE key IN (
--    'pricing_engine', 'pricing_shadow_compare',
--    'pricing_v2_price_per_km', 'pricing_v2_visit_fee',
--    'pricing_v2_extra_location_rate', 'pricing_v2_weeks'
--  );
