-- =====================================================================
-- Migration 006 — Critical Fixes: app_config table & default bid fee
-- نظام توصّلني — جدول إعدادات التطبيق ورسوم العرض الافتراضية
-- =====================================================================
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- الأهداف:
--   1. إنشاء جدول app_config لتخزين إعدادات التطبيق كمفتاح/قيمة
--   2. تعيين قيمة افتراضية لرسوم العرض (50 ريال)
--   3. تطبيق RLS على الجدول الجديد
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Create app_config table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

COMMENT ON TABLE public.app_config IS
  'Key-value store for application-wide configuration.'
  ' Read by the Express backend; never exposed directly to clients.';

COMMENT ON COLUMN public.app_config.key IS
  'Configuration key, e.g. "bid_fee".';

COMMENT ON COLUMN public.app_config.value IS
  'Configuration value stored as text. Cast to the appropriate type on read.';


-- ─────────────────────────────────────────────────────────────────────
-- 2. Seed default values
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
  VALUES ('bid_fee', '50')
  ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Enable RLS — blocks direct Supabase REST / anon access
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow backend (postgres / service_role) full access
DROP POLICY IF EXISTS app_config_service_role_all ON public.app_config;
CREATE POLICY app_config_service_role_all
  ON public.app_config FOR ALL
  TO postgres, service_role
  USING (true) WITH CHECK (true);

-- Revoke all privileges from anon and authenticated roles
REVOKE ALL PRIVILEGES ON TABLE public.app_config FROM anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check table and default value:
--   SELECT key, value FROM public.app_config;
--
-- Check RLS is enabled:
--   SELECT tablename, rowsecurity
--     FROM pg_tables
--    WHERE schemaname = 'public' AND tablename = 'app_config';
