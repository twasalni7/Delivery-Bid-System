-- =====================================================================
-- Migration 008: Seed dynamic pricing configuration into app_config
-- نظام توصّلني — إعدادات التسعير الديناميكي
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/008_pricing_config.sql
-- Or paste into Supabase SQL Editor
--
-- الأهداف:
--   1. إضافة نطاقات المسافة والأسعار الافتراضية
--   2. إضافة خصومات الاشتراك المشترك
--   3. إضافة معايير القرب للاشتراك المشترك
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Distance pricing tiers (JSON array)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES (
  'pricing_tiers',
  '[{"max":5,"base":500},{"max":10,"base":800},{"max":15,"base":1000},{"max":20,"base":1200},{"max":25,"base":1400},{"max":30,"base":1700},{"max":40,"base":2200}]'
)
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Sharing discounts (JSON array) — per-person factor
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES (
  'sharing_discounts',
  '[{"people":1,"factor":1.0},{"people":2,"factor":0.72},{"people":3,"factor":0.60},{"people":4,"factor":0.52}]'
)
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Proximity thresholds for shared subscription detection
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value) VALUES ('proximity_home_km',       '2')  ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_config (key, value) VALUES ('proximity_work_km',       '2')  ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_config (key, value) VALUES ('proximity_time_minutes',  '30') ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT key, value FROM public.app_config
--  WHERE key IN (
--    'pricing_tiers', 'sharing_discounts',
--    'proximity_home_km', 'proximity_work_km', 'proximity_time_minutes'
--  );
