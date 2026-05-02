-- =====================================================================
-- Migration 009: activity_logs + service_areas
-- نظام توصّلني — سجلات النشاط + مناطق الخدمة
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/009_activity_logs_and_service_areas.sql
-- Or paste into Supabase SQL Editor
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- الأهداف:
--   1. إنشاء جدول activity_logs لتسجيل جميع العمليات
--   2. إنشاء جدول service_areas للمدن والأحياء في المنطقة الشرقية
--   3. تعبئة البيانات الأولية لمناطق الخدمة في المنطقة الشرقية
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. activity_logs — سجل كامل لجميع العمليات في النظام
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          BIGSERIAL   PRIMARY KEY,
  -- من قام بالعملية
  actor_id    INTEGER,
  actor_role  TEXT        NOT NULL DEFAULT 'system',   -- 'admin' | 'client' | 'driver' | 'system'
  -- نوع العملية ومحتواها
  action      TEXT        NOT NULL,                     -- مثال: 'request.created', 'offer.accepted'
  entity      TEXT        NOT NULL,                     -- الجدول المتأثر: 'requests', 'offers', ...
  entity_id   INTEGER,                                  -- معرّف السجل المتأثر
  -- تفاصيل إضافية (قيم قبل/بعد التعديل، بيانات الجلسة...)
  metadata    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_logs IS
  'Immutable audit trail of all system operations. Never update or delete rows.';

COMMENT ON COLUMN public.activity_logs.actor_id IS
  'ID of the user who performed the action (NULL for system/automated actions).';

COMMENT ON COLUMN public.activity_logs.actor_role IS
  'Role of the actor: admin, client, driver, or system.';

COMMENT ON COLUMN public.activity_logs.action IS
  'Dot-notation action name, e.g. "request.created", "offer.accepted", "driver.blocked".';

COMMENT ON COLUMN public.activity_logs.entity IS
  'Name of the primary table affected, e.g. "requests", "offers", "drivers".';

COMMENT ON COLUMN public.activity_logs.entity_id IS
  'Primary key of the affected record. NULL for bulk or non-record actions.';

COMMENT ON COLUMN public.activity_logs.metadata IS
  'Arbitrary JSON payload with additional context (old/new values, notes, etc.).';


-- Indexes on activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON public.activity_logs (actor_id, actor_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs (entity, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON public.activity_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);


-- RLS: activity_logs is insert-only from backend; no direct client access
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_service_role_all ON public.activity_logs;
CREATE POLICY activity_logs_service_role_all
  ON public.activity_logs FOR ALL
  TO postgres, service_role
  USING (true) WITH CHECK (true);

REVOKE ALL PRIVILEGES ON TABLE public.activity_logs FROM anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 2. service_areas — المدن والأحياء المخدومة في المنطقة الشرقية
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_areas (
  id          SERIAL      PRIMARY KEY,
  city        TEXT        NOT NULL,             -- اسم المدينة / البلدة
  district    TEXT,                             -- الحي (اختياري)
  lat         DOUBLE PRECISION,                 -- خط العرض (WGS84)
  lng         DOUBLE PRECISION,                 -- خط الطول (WGS84)
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.service_areas IS
  'Cities and districts served by the platform (Eastern Region of Saudi Arabia).';

COMMENT ON COLUMN public.service_areas.city IS
  'City or town name in Arabic.';

COMMENT ON COLUMN public.service_areas.district IS
  'Optional neighbourhood/district name within the city.';

COMMENT ON COLUMN public.service_areas.lat IS
  'Representative latitude of the area centre (WGS84).';

COMMENT ON COLUMN public.service_areas.lng IS
  'Representative longitude of the area centre (WGS84).';


-- Indexes on service_areas
CREATE INDEX IF NOT EXISTS idx_service_areas_city
  ON public.service_areas (city);

CREATE INDEX IF NOT EXISTS idx_service_areas_active
  ON public.service_areas (is_active)
  WHERE is_active = TRUE;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Seed: مدن وأحياء المنطقة الشرقية
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.service_areas (city, district, lat, lng) VALUES
  -- الخبر
  ('الخبر',    NULL,           26.2172, 50.1971),
  ('الخبر',    'الكورنيش',     26.2205, 50.2006),
  ('الخبر',    'العقربية',     26.2400, 50.1890),
  ('الخبر',    'الراكة الشمالية', 26.2550, 50.1900),
  -- الدمام
  ('الدمام',   NULL,           26.4327, 50.1037),
  ('الدمام',   'الفيصلية',     26.4200, 50.0900),
  ('الدمام',   'النزهة',       26.4400, 50.1100),
  ('الدمام',   'الشاطئ',       26.4600, 50.1300),
  ('الدمام',   'المريكبات',    26.4100, 50.0800),
  -- الظهران
  ('الظهران',  NULL,           26.2694, 50.1535),
  ('الظهران',  'حي الاتحاد',   26.2800, 50.1600),
  ('الظهران',  'أرامكو',       26.2600, 50.1400),
  -- العزيزية
  ('العزيزية', NULL,           26.3100, 50.1200),
  -- الراكة
  ('الراكة',   NULL,           26.2550, 50.1920),
  -- النابية
  ('النابية',  NULL,           26.5200, 50.0300),
  -- سيهات
  ('سيهات',    NULL,           26.4800, 49.9700),
  ('سيهات',    'وسط المدينة',  26.4820, 49.9720),
  -- القطيف
  ('القطيف',   NULL,           26.5081, 50.0102),
  ('القطيف',   'العوامية',     26.5800, 49.9800),
  ('القطيف',   'صفوى',         26.6500, 49.9600),
  ('القطيف',   'تاروت',        26.5700, 50.0500)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check tables exist:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public'
--      AND table_name IN ('activity_logs', 'service_areas');
--
-- Check service_areas seed:
--   SELECT city, COUNT(*) FROM public.service_areas GROUP BY city ORDER BY city;
