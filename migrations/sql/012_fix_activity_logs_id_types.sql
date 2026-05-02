-- =====================================================================
-- Migration 012: Fix activity_logs column types (uuid → integer)
-- نظام توصّلني — تصحيح أنواع أعمدة المعرّفات في جدول activity_logs
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/012_fix_activity_logs_id_types.sql
-- Or paste into Supabase SQL Editor
--
-- المشكلة:
--   تم إنشاء عمودَي actor_id و entity_id بنوع uuid بدلاً من integer.
--   يستخدم النظام معرّفات SERIAL صحيحة للسائقين/العملاء/المسؤولين،
--   مما يتسبب في خطأ: "invalid input syntax for type uuid"
--   عند محاولة تسجيل النشاط.
--
-- الحل:
--   تحويل النوع إلى INTEGER (مع إهمال أي قيم uuid موجودة).
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- Drop indexes that reference actor_id / entity_id before altering
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_activity_logs_actor;
DROP INDEX IF EXISTS idx_activity_logs_entity;


-- ─────────────────────────────────────────────────────────────────────
-- Alter column types from uuid to integer
-- Existing rows (if any) will have these columns set to NULL because
-- UUID values cannot be cast to integers.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.activity_logs
  ALTER COLUMN actor_id  TYPE INTEGER USING NULL,
  ALTER COLUMN entity_id TYPE INTEGER USING NULL;


-- ─────────────────────────────────────────────────────────────────────
-- Re-create the dropped indexes
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON public.activity_logs (actor_id, actor_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs (entity, entity_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check column types:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name   = 'activity_logs'
--      AND column_name  IN ('actor_id', 'entity_id');
-- Expected: data_type = 'integer' for both columns.
