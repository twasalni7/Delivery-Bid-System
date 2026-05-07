-- =====================================================================
-- Migration 026: Activate formula_v2 pricing engine
-- نظام توصّلني — تفعيل نظام التسعير الجديد
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/026_activate_formula_v2.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. تغيير محرك التسعير إلى formula_v2 (تفعيل النظام الجديد)
--   2. تفعيل المقارنة التظليلية لتسجيل الفرق بين النظامين في الـ logs
--
-- ملاحظة: النظام القديم (matrix) محفوظ تمامًا ويمكن الرجوع إليه في أي وقت
-- عبر تحديث قيمة pricing_engine إلى 'matrix'.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Switch active engine to formula_v2
--    يُحدّث الصف الموجود، أو يُنشئه إن لم يكن موجودًا
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('pricing_engine', 'formula_v2')
ON CONFLICT (key) DO UPDATE SET value = 'formula_v2';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Enable shadow compare
--    يُشغّل حساب النظامين معًا ويسجّل الفرق في الـ logs
--    دون التأثير على السعر الفعلي المعروض للمستخدم
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('pricing_shadow_compare', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Ensure formula_v2 constants exist (insert defaults if missing)
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
-- Verification — run this to confirm the switch
-- ─────────────────────────────────────────────────────────────────────
-- SELECT key, value FROM public.app_config
--  WHERE key IN (
--    'pricing_engine', 'pricing_shadow_compare',
--    'pricing_v2_price_per_km', 'pricing_v2_visit_fee',
--    'pricing_v2_extra_location_rate', 'pricing_v2_weeks'
--  )
--  ORDER BY key;
--
-- Expected:
--   pricing_engine                = formula_v2
--   pricing_shadow_compare        = true
--   pricing_v2_extra_location_rate= 0.15
--   pricing_v2_price_per_km       = 0.85
--   pricing_v2_visit_fee          = 15
--   pricing_v2_weeks              = 4
