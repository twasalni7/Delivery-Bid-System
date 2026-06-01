-- Combined migration script for migrations after 000_full_schema.sql
-- Run /tmp/workspace/twasalni7/Delivery-Bid-System/migrations/sql/000_full_schema.sql first, then run this file once.

-- =====================================================================
-- BEGIN 001_enable_rls_and_policies.sql
-- =====================================================================

-- =====================================================================
-- Migration 001 — Enable Row Level Security (RLS) & Access Policies
-- نظام توصّلني — تفعيل أمان الصفوف والسياسات
-- =====================================================================
--
-- ⚠️  تحذير: راجع أسماء الجداول والأعمدة، وشغّل على staging أولاً.
--            أخذ نسخة احتياطية قبل التنفيذ.
--
-- Context:
--   This project uses its own session-based auth (not Supabase Auth),
--   so RLS policies here guard against direct DB access (e.g. via
--   Supabase Studio or any client that bypasses the API).
--   The service-role key (used by the API server) bypasses RLS by
--   design; all policy checks are belt-and-suspenders for direct access.
--
-- Verify these match your schema before running:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Enable RLS on all user-facing tables
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS admins                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS offers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bank_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications         ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Deny-all defaults
--    Any authenticated Supabase user (anon or authenticated role) gets
--    no rows unless an explicit USING policy grants access.
--    The API server connects with the service role and is exempt.
-- ─────────────────────────────────────────────────────────────────────

-- Drop existing policies to allow re-running idempotently
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admins','clients','drivers','requests','offers',
        'support_tickets','transactions','wallet_transactions',
        'bank_accounts','notifications'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. BLOCK direct anon/authenticated access by default
--    (No USING clause → no rows visible; no WITH CHECK → no writes)
--    These are "deny all" sentinels; the API service role bypasses them.
-- ─────────────────────────────────────────────────────────────────────

CREATE POLICY "deny_all_admins"
  ON admins FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_clients"
  ON clients FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_drivers"
  ON drivers FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_requests"
  ON requests FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_offers"
  ON offers FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_support_tickets"
  ON support_tickets FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_transactions"
  ON transactions FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_wallet_transactions"
  ON wallet_transactions FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_bank_accounts"
  ON bank_accounts FOR ALL TO anon, authenticated USING (false);

CREATE POLICY "deny_all_notifications"
  ON notifications FOR ALL TO anon, authenticated USING (false);


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, cmd, roles, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;

-- END 001_enable_rls_and_policies.sql

-- =====================================================================
-- BEGIN 002_indexes_and_constraints.sql
-- =====================================================================

-- =====================================================================
-- Migration 002 — Performance Indexes & Data-Integrity Constraints
-- نظام توصّلني — الفهارس والقيود
-- =====================================================================
--
-- ⚠️  تحذير: راجع الأسماء على schema الفعلي، وشغّل على staging أولاً.
--            أخذ نسخة احتياطية قبل التنفيذ.
--
-- Note: FK constraints referencing drivers(id) and clients(id) already
-- exist in the schema DDL (full_schema.sql).  This file adds missing
-- performance indexes and the partial-unique guard index.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Performance indexes
-- ─────────────────────────────────────────────────────────────────────

-- requests: filter/sort by client and status
CREATE INDEX IF NOT EXISTS idx_requests_client_id
  ON requests (client_id);

CREATE INDEX IF NOT EXISTS idx_requests_status_created
  ON requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_selected_driver
  ON requests (selected_driver_id)
  WHERE selected_driver_id IS NOT NULL;

-- offers: look up offers by request or driver
CREATE INDEX IF NOT EXISTS idx_offers_request_id
  ON offers (request_id);

CREATE INDEX IF NOT EXISTS idx_offers_driver_id
  ON offers (driver_id);

-- notifications: user inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, user_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, user_role, is_read)
  WHERE is_read = false;

-- transactions: driver statement queries
CREATE INDEX IF NOT EXISTS idx_transactions_driver_id
  ON transactions (driver_id, created_at DESC);

-- wallet_transactions: driver wallet history
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_driver_id
  ON wallet_transactions (driver_id, created_at DESC);

-- support_tickets: lookup by client or driver
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_id
  ON support_tickets (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_driver_id
  ON support_tickets (driver_id)
  WHERE driver_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Prevent duplicate accepted offers per request
--    (partial unique index: only one SELECTED offer allowed per request)
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS unique_request_selected_offer
  ON offers (request_id)
  WHERE status = 'SELECTED';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Prevent duplicate pending offers from the same driver per request
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS unique_driver_request_pending_offer
  ON offers (driver_id, request_id)
  WHERE status = 'PENDING';

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;

-- END 002_indexes_and_constraints.sql

-- =====================================================================
-- BEGIN 003_accept_offer_function.sql
-- =====================================================================

-- =====================================================================
-- Migration 003 — Atomic accept_offer DB Function
-- نظام توصّلني — دالة قبول العرض الذرية (مع قفل الصف)
-- =====================================================================
--
-- ⚠️  تحذير: راجع الأسماء على schema الفعلي، وشغّل على staging أولاً.
--            أخذ نسخة احتياطية قبل التنفيذ.
--
-- Purpose:
--   Wrap the "select offer" business logic inside a single Postgres
--   function that acquires a row-level lock on the request before
--   making any changes, ensuring that concurrent calls cannot double-
--   accept the same request.
--
-- Parameters:
--   p_request_id   INTEGER  — ID of the transport request
--   p_offer_id     INTEGER  — ID of the offer being accepted
--   p_client_id    INTEGER  — ID of the client accepting (ownership check)
--   p_driver_fee   REAL     — Platform fee deducted from driver balance
--                             (default 50.0, matches current business rule)
--
-- Returns: TABLE with updated request and driver data for the API response.
--
-- Usage (from the API server via Drizzle / raw SQL):
--   SELECT * FROM accept_offer(1, 3, 7, 50.0);
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accept_offer(
  p_request_id  INTEGER,
  p_offer_id    INTEGER,
  p_client_id   INTEGER,
  p_driver_fee  REAL DEFAULT 50.0
)
RETURNS TABLE (
  request_id        INTEGER,
  request_status    TEXT,
  selected_driver_id INTEGER,
  driver_id_out     INTEGER,
  driver_balance    REAL
)
LANGUAGE plpgsql
SECURITY DEFINER   -- Runs with the function owner's privileges so it can
                   -- write to tables protected by the deny-all RLS policies
                   -- added in migration 001.  The API service role still
                   -- bypasses RLS directly, but this function is also callable
                   -- from contexts that hold only the anon/authenticated role.
AS $$
DECLARE
  v_request      requests%ROWTYPE;
  v_offer        offers%ROWTYPE;
  v_driver       drivers%ROWTYPE;
BEGIN
  -- 1. Lock the request row to prevent concurrent accepts
  SELECT * INTO v_request
    FROM requests
   WHERE id = p_request_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: request % does not exist', p_request_id;
  END IF;

  -- 2. Ownership check
  IF v_request.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller % does not own request %',
                    p_client_id, p_request_id;
  END IF;

  -- 3. Status guard — must be OPEN
  IF v_request.status <> 'OPEN' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN: request % has status %',
                    p_request_id, v_request.status;
  END IF;

  -- 4. Validate offer belongs to request
  SELECT * INTO v_offer
    FROM offers
   WHERE id = p_offer_id
     AND request_id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND: offer % not found for request %',
                    p_offer_id, p_request_id;
  END IF;

  IF v_offer.status <> 'PENDING' THEN
    RAISE EXCEPTION 'OFFER_NOT_PENDING: offer % has status %',
                    p_offer_id, v_offer.status;
  END IF;

  -- 5. Lock and validate the driver
  SELECT * INTO v_driver
    FROM drivers
   WHERE id = v_offer.driver_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: driver % does not exist', v_offer.driver_id;
  END IF;

  IF v_driver.balance < p_driver_fee THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: driver % balance %.2f < required %.2f',
                    v_driver.id, v_driver.balance, p_driver_fee;
  END IF;

  -- 6. Deduct platform fee from driver
  UPDATE drivers
     SET balance = balance - p_driver_fee
   WHERE id = v_driver.id;

  -- 7. Record the fee transaction
  INSERT INTO transactions (driver_id, amount, type)
  VALUES (v_driver.id, -p_driver_fee, 'fee');

  -- 8. Mark request as SELECTED
  UPDATE requests
     SET status            = 'SELECTED',
         selected_driver_id = v_driver.id,
         updated_at         = NOW()
   WHERE id = p_request_id;

  -- 9. Mark offer as SELECTED, cancel all other PENDING offers for this request
  UPDATE offers
     SET status = 'SELECTED'
   WHERE id = p_offer_id;

  UPDATE offers
     SET status = 'CANCELLED'
   WHERE request_id = p_request_id
     AND id         <> p_offer_id
     AND status     = 'PENDING';

  -- 10. Return updated values for the API response
  RETURN QUERY
    SELECT
      r.id                   AS request_id,
      r.status::TEXT         AS request_status,
      r.selected_driver_id,
      d.id                   AS driver_id_out,
      d.balance              AS driver_balance
    FROM requests r
    JOIN drivers  d ON d.id = r.selected_driver_id
   WHERE r.id = p_request_id;
END;
$$;

-- Grant execute to the API server role
-- (replace 'api_user' with the actual DB role used by your API server)
-- GRANT EXECUTE ON FUNCTION public.accept_offer(INTEGER, INTEGER, INTEGER, REAL) TO api_user;

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT proname, prosrc FROM pg_proc
--   WHERE proname = 'accept_offer' AND pronamespace = 'public'::regnamespace;

-- END 003_accept_offer_function.sql

-- =====================================================================
-- BEGIN 004_shifts_messages_live_support.sql
-- =====================================================================

-- =====================================================================
-- Migration 004 — Shifts column, Messages table, LIVE_SUPPORT status
-- نظام توصّلني — إضافة عمود الوردیات، جدول الرسائل، حالة الدعم المباشر
-- =====================================================================
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- Changes:
--   1. Add `shifts` JSONB column to `requests` table for multiple time
--      slots per request.
--   2. Add `LIVE_SUPPORT` to the `ticket_status` enum so support tickets
--      can enter a real-time chat state.
--   3. Create `messages` table linked to a request for live chat between
--      the client and the assigned driver (and optionally admins).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add shifts column to requests
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS shifts JSONB;

COMMENT ON COLUMN requests.shifts IS
  'Optional JSONB array of time-slot objects, e.g. [{"label":"morning","goTime":"07:00","returnTime":"15:00"}]. '
  'Supersedes the scalar morningTime/eveningTime when present.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Extend ticket_status enum with LIVE_SUPPORT
--    PostgreSQL does not support removing enum values, so we ADD only.
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Only add if not already present (idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ticket_status'
      AND e.enumlabel = 'LIVE_SUPPORT'
  ) THEN
    ALTER TYPE ticket_status ADD VALUE 'LIVE_SUPPORT';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Create messages table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender_role   TEXT    NOT NULL CHECK (sender_role IN ('client', 'driver', 'admin')),
  sender_id     INTEGER NOT NULL,
  body          TEXT    NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_request_id_idx
  ON messages (request_id, created_at);

-- RLS — deny direct access; the API service role bypasses RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'messages'
      AND policyname  = 'deny_all_messages'
  ) THEN
    CREATE POLICY deny_all_messages
      ON messages FOR ALL TO anon, authenticated USING (false);
  END IF;
END
$$;

COMMENT ON TABLE messages IS
  'Live-chat messages scoped to a delivery request. '
  'Clients, drivers, and admins can post and read messages for requests they are party to.';

-- END 004_shifts_messages_live_support.sql

-- =====================================================================
-- BEGIN 005_push_subscription_webhook.sql
-- =====================================================================

-- =====================================================================
-- Migration 005 — push_subscription column & Database Webhook trigger
-- نظام توصّلني — عمود اشتراك الإشعارات وتريغر pg_net لإرسالها تلقائياً
-- =====================================================================
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- المتطلبات قبل تشغيل هذا الملف:
--   1. تفعيل امتداد pg_net في Supabase:
--        Dashboard → Database → Extensions → pg_net → Enable
--      أو:
--        CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
--
--   2. إنشاء جدول app_config وتعبئته (مرة واحدة):
--        CREATE TABLE IF NOT EXISTS public.app_config (
--          key   TEXT PRIMARY KEY,
--          value TEXT NOT NULL
--        );
--        INSERT INTO public.app_config (key, value)
--          VALUES
--            ('supabase_url',       'https://<ref>.supabase.co'),
--            ('service_role_key',   '<service_role_key>')
--          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
--   3. نشر Edge Function:
--        supabase functions deploy send-push-notification
--      أو عبر Supabase Dashboard → Edge Functions → Deploy.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add push_subscription JSONB column to profiles table (legacy)
--    This project uses push_subscriptions table instead of Supabase
--    Auth profiles.  The ALTER TABLE below is guarded with an existence
--    check so it is safe to run even when the profiles table does not
--    exist (e.g. fresh installs or non-Supabase environments).
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS push_subscription JSONB;

    COMMENT ON COLUMN profiles.push_subscription IS
      'Web Push PushSubscription object { endpoint, keys: { p256dh, auth } }.'
      ' Populated after the user grants notification permission in the browser.';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Ensure pg_net extension is enabled
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Trigger function
--    Fires AFTER INSERT on notifications and calls the Edge Function
--    send-push-notification via net.http_post (pg_net — fire-and-forget).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url     TEXT;
  _service_role_key TEXT;
BEGIN
  -- Read project settings from public.app_config table
  SELECT value INTO _supabase_url
    FROM public.app_config
   WHERE key = 'supabase_url'
   LIMIT 1;

  SELECT value INTO _service_role_key
    FROM public.app_config
   WHERE key = 'service_role_key'
   LIMIT 1;

  -- Skip if settings are not configured
  IF _supabase_url IS NULL OR _supabase_url = ''
     OR _service_role_key IS NULL OR _service_role_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to the Edge Function (non-blocking)
  -- Only the fields consumed by the Edge Function are sent to minimize payload.
  PERFORM extensions.http_post(
    url     := _supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id',   NEW.user_id,
        'user_role', NEW.user_role,
        'title',     NEW.title,
        'message',   NEW.message
      )
    )
  );

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 4. Attach trigger to notifications table
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;

CREATE TRIGGER on_notification_insert_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_push_notification();


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check push_subscription column was added:
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND column_name  = 'push_subscription';
--
-- Check trigger exists:
--   SELECT trigger_name, event_manipulation, action_timing
--     FROM information_schema.triggers
--    WHERE event_object_table = 'notifications'
--      AND trigger_name = 'on_notification_insert_send_push';
--
-- Check function exists:
--   SELECT proname FROM pg_proc
--    WHERE proname = 'trigger_send_push_notification'
--      AND pronamespace = 'public'::regnamespace;

-- END 005_push_subscription_webhook.sql

-- =====================================================================
-- BEGIN 006_critical_fixes.sql
-- =====================================================================

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

-- END 006_critical_fixes.sql

-- =====================================================================
-- BEGIN 007_pricing_and_coordinates.sql
-- =====================================================================

-- =====================================================================
-- Migration 007: Add coordinate and pricing fields to requests table
-- نظام توصّلني — إضافة حقول الإحداثيات والتسعير التلقائي
-- =====================================================================
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/007_pricing_and_coordinates.sql
-- Or paste into Supabase SQL Editor
--
-- ⚠️  تحذير: راجع على staging أولاً وأخذ نسخة احتياطية قبل التنفيذ.
--
-- الأهداف:
--   1. إضافة حقول الإحداثيات (latitude/longitude) للموقع المنزلي والوجهة
--   2. إضافة حقل المسافة المحسوبة (distance_km)
--   3. إضافة علامة needs_admin_review للطلبات التي تتجاوز 40 كم
--   4. إنشاء فهرس للطلبات التي تحتاج مراجعة الإدارة
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add coordinate and pricing fields
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS home_lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lat           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lng           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km        REAL,
  ADD COLUMN IF NOT EXISTS needs_admin_review BOOLEAN NOT NULL DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Add column comments for documentation
-- ─────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.requests.home_lat IS
  'Home location latitude (WGS84)';

COMMENT ON COLUMN public.requests.home_lng IS
  'Home location longitude (WGS84)';

COMMENT ON COLUMN public.requests.dest_lat IS
  'Destination latitude (WGS84)';

COMMENT ON COLUMN public.requests.dest_lng IS
  'Destination longitude (WGS84)';

COMMENT ON COLUMN public.requests.distance_km IS
  'Straight-line distance in km (Haversine)';

COMMENT ON COLUMN public.requests.needs_admin_review IS
  'True when distance > 40 km — admin must approve before drivers can see the request';


-- ─────────────────────────────────────────────────────────────────────
-- 3. Create index for admin review queries
-- ─────────────────────────────────────────────────────────────────────
-- Index to let admin quickly find requests awaiting review
CREATE INDEX IF NOT EXISTS idx_requests_needs_review
  ON public.requests (needs_admin_review)
  WHERE needs_admin_review = TRUE;


-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Check columns were added:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'requests'
--      AND column_name IN ('home_lat', 'home_lng', 'dest_lat', 'dest_lng', 'distance_km', 'needs_admin_review');
--
-- Check index was created:
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public'
--      AND tablename = 'requests'
--      AND indexname = 'idx_requests_needs_review';

-- END 007_pricing_and_coordinates.sql

-- =====================================================================
-- BEGIN 008_pricing_config.sql
-- =====================================================================

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

-- END 008_pricing_config.sql

-- =====================================================================
-- BEGIN 009_activity_logs_and_service_areas.sql
-- =====================================================================

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

-- END 009_activity_logs_and_service_areas.sql

-- =====================================================================
-- BEGIN 010_pricing_matrix.sql
-- =====================================================================

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

-- END 010_pricing_matrix.sql

-- =====================================================================
-- BEGIN 011_pricing_matrix_price_sar.sql
-- =====================================================================

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

-- END 011_pricing_matrix_price_sar.sql

-- =====================================================================
-- BEGIN 012_fix_activity_logs_id_types.sql
-- =====================================================================

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
--
-- ⚠️  Data-loss note:
--   UUID values stored in actor_id / entity_id on existing rows cannot
--   be automatically converted to integers, so they are coerced to NULL.
--   activity_logs is an append-only audit table; the rows themselves are
--   preserved and only the (now-meaningless) uuid actor/entity references
--   are cleared.  Take a database backup before running this migration
--   in production if the existing rows carry audit value.
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

-- END 012_fix_activity_logs_id_types.sql

-- =====================================================================
-- BEGIN 013_user_tokens.sql
-- =====================================================================

-- 013_user_tokens.sql
-- Persistent auth tokens stored in localStorage on clients (replaces cookie-based sessions)

CREATE TABLE IF NOT EXISTS user_tokens (
  token       TEXT PRIMARY KEY CHECK (length(token) = 64),
  user_id     INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
  name        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at ON user_tokens (expires_at);

-- Clean up expired tokens automatically (requires pg_cron or periodic job;
-- this function can be called manually or via a scheduled task)
CREATE OR REPLACE FUNCTION delete_expired_user_tokens() RETURNS void AS $$
  DELETE FROM user_tokens WHERE expires_at < now();
$$ LANGUAGE SQL;

-- END 013_user_tokens.sql

-- =====================================================================
-- BEGIN 014_user_tokens_rls.sql
-- =====================================================================

-- 014_user_tokens_rls.sql
-- Enable RLS on user_tokens so direct Supabase REST / anon access is blocked.
-- The API server connects via the service role and bypasses RLS by design.

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Deny-all sentinel for anon and authenticated Supabase roles.
-- Service role (used by the Express API) is exempt from RLS.
DROP POLICY IF EXISTS deny_all_user_tokens ON user_tokens;
CREATE POLICY deny_all_user_tokens
  ON user_tokens
  FOR ALL
  TO anon, authenticated
  USING (false);

-- END 014_user_tokens_rls.sql

-- =====================================================================
-- BEGIN 015_operations_monitoring.sql
-- =====================================================================

-- System errors table
CREATE TABLE IF NOT EXISTS system_errors (
  id SERIAL PRIMARY KEY,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  page TEXT,
  user_id INTEGER,
  user_role TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'error',
  resolved TEXT NOT NULL DEFAULT 'false',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  is_read TEXT NOT NULL DEFAULT 'false',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Request stops table for multi-stop routing
CREATE TABLE IF NOT EXISTS request_stops (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  stop_type TEXT NOT NULL DEFAULT 'waypoint',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_stops_request_id ON request_stops(request_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);

-- END 015_operations_monitoring.sql

-- =====================================================================
-- BEGIN 016_request_passengers.sql
-- =====================================================================

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

-- END 016_request_passengers.sql

-- =====================================================================
-- BEGIN 017_notification_tracking.sql
-- =====================================================================

-- =====================================================================
-- Migration 017 — Notification tracking fields
-- Adds delivered_at, clicked_at, and url columns to the notifications table.
-- =====================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS url         TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ;

-- Index for analytics queries (count delivered / clicked per time range)
CREATE INDEX IF NOT EXISTS idx_notifications_delivered_at
  ON notifications (delivered_at)
  WHERE delivered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_clicked_at
  ON notifications (clicked_at)
  WHERE clicked_at IS NOT NULL;

-- Index used by the cleanup job (stale subscription detection)
CREATE INDEX IF NOT EXISTS idx_notifications_user_delivered
  ON notifications (user_id, user_role, delivered_at);

-- END 017_notification_tracking.sql

-- =====================================================================
-- BEGIN 018_financial_integrity.sql
-- =====================================================================

-- =====================================================================
-- Migration 018 — Financial integrity + type correctness fixes
--
-- 1. Monetary columns: real (float4) → numeric(12,2) so no floating-point
--    rounding ever occurs on money values (balance, amounts, monthly price).
-- 2. Distance columns: real → double precision (float8) for better precision.
-- 3. system_alerts.is_read and system_errors.resolved: TEXT → BOOLEAN so
--    JavaScript truthiness (non-empty string == true) is no longer a trap.
-- 4. wallet_transactions.int_id: introduce a real PostgreSQL SEQUENCE so
--    concurrent inserts never race on MAX(int_id)+1.
-- =====================================================================

-- ── 1. drivers.balance  ───────────────────────────────────────────────────────
ALTER TABLE drivers
  ALTER COLUMN balance TYPE NUMERIC(12,2)
    USING balance::NUMERIC(12,2);

ALTER TABLE drivers
  ALTER COLUMN balance SET DEFAULT 0;

-- ── 2. transactions.amount  ───────────────────────────────────────────────────
ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(12,2)
    USING amount::NUMERIC(12,2);

-- ── 3. requests.monthly_price  ────────────────────────────────────────────────
ALTER TABLE requests
  ALTER COLUMN monthly_price TYPE NUMERIC(12,2)
    USING monthly_price::NUMERIC(12,2);

ALTER TABLE requests
  ALTER COLUMN monthly_price SET DEFAULT 0;

-- ── 4. requests.distance_km  ──────────────────────────────────────────────────
ALTER TABLE requests
  ALTER COLUMN distance_km TYPE DOUBLE PRECISION
    USING distance_km::DOUBLE PRECISION;

-- ── 5. request_passengers.distance_km  ───────────────────────────────────────
ALTER TABLE request_passengers
  ALTER COLUMN distance_km TYPE DOUBLE PRECISION
    USING distance_km::DOUBLE PRECISION;

-- ── 6. system_alerts.is_read  ─────────────────────────────────────────────────
-- Drop the existing TEXT default first; PostgreSQL cannot auto-cast a text
-- default expression when changing the column type to boolean.
ALTER TABLE system_alerts
  ALTER COLUMN is_read DROP DEFAULT;

ALTER TABLE system_alerts
  ALTER COLUMN is_read TYPE BOOLEAN
    USING (is_read = 'true');

ALTER TABLE system_alerts
  ALTER COLUMN is_read SET DEFAULT FALSE;

-- ── 7. system_errors.resolved  ────────────────────────────────────────────────
ALTER TABLE system_errors
  ALTER COLUMN resolved DROP DEFAULT;

ALTER TABLE system_errors
  ALTER COLUMN resolved TYPE BOOLEAN
    USING (resolved = 'true');

ALTER TABLE system_errors
  ALTER COLUMN resolved SET DEFAULT FALSE;

-- ── 8. wallet_transactions.int_id sequence  ───────────────────────────────────
-- Creates a proper sequence so concurrent POST /wallet-transactions requests
-- never collide on a MAX+1 read-modify-write.
CREATE SEQUENCE IF NOT EXISTS wallet_transactions_int_id_seq;

-- Seed the sequence to the current maximum so existing rows are not duplicated.
SELECT setval(
  'wallet_transactions_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM wallet_transactions), 0)
);

-- Wire the default; existing rows keep their values.
ALTER TABLE wallet_transactions
  ALTER COLUMN int_id SET DEFAULT nextval('wallet_transactions_int_id_seq');

-- END 018_financial_integrity.sql

-- =====================================================================
-- BEGIN 019_code_compat_fixes.sql
-- =====================================================================

-- =====================================================================
-- Migration 019 — Code-compatibility fixes (post-018)
--
-- Context: Migration 018 altered system_errors.resolved and
-- system_alerts.is_read from TEXT → BOOLEAN, but the application code
-- was still using string literals ("true"/"false") to compare/set those
-- columns.  This migration is a no-op on the DB itself (the schema is
-- already correct after 018) but documents the required code changes
-- and adds a useful covering index for offer-status queries.
--
-- DB changes in this file:
--   1. Add index on offers(status) — used by soft-delete queries that
--      filter by status = 'CANCELLED'.
--   2. Ensure wallet_transactions_int_id_seq exists and its DEFAULT is
--      wired to the column (idempotent repeat of 018 for safety).
-- =====================================================================

-- ── 1. Index for offer status queries (soft-delete reads)  ───────────
CREATE INDEX IF NOT EXISTS idx_offers_status
  ON offers (status);

-- ── 2. Idempotent sequence wiring for wallet_transactions.int_id  ─────
-- (Migration 018 already created this sequence; this block is safe to
-- re-run and guards against environments where 018 was only partially
-- applied.)
CREATE SEQUENCE IF NOT EXISTS wallet_transactions_int_id_seq;

SELECT setval(
  'wallet_transactions_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM wallet_transactions), 0)
) WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'wallet_transactions'
    AND column_name = 'int_id'
    AND column_default LIKE '%wallet_transactions_int_id_seq%'
);

ALTER TABLE wallet_transactions
  ALTER COLUMN int_id SET DEFAULT nextval('wallet_transactions_int_id_seq');

-- END 019_code_compat_fixes.sql

-- =====================================================================
-- BEGIN 020_push_subscriptions_role.sql
-- =====================================================================

-- =====================================================================
-- Migration 020 — push_subscriptions: add user_role + upsert support
-- =====================================================================
-- Adds user_role column and a unique constraint on (user_id, user_role)
-- so that each user/role combination has exactly one push subscription
-- and we can do INSERT … ON CONFLICT DO UPDATE (upsert).
-- =====================================================================

-- 1. Add user_role column (idempotent)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'client';

-- Remove the default after adding (the column must be NOT NULL but we
-- don't want a permanent default on new rows).
ALTER TABLE push_subscriptions
  ALTER COLUMN user_role DROP DEFAULT;

-- 2. Add unique index on (user_id, user_role) for upsert support.
--    Use a DO block so it is idempotent (IF NOT EXISTS is not available
--    for CREATE UNIQUE INDEX in older Postgres versions).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  tablename  = 'push_subscriptions'
    AND    indexname  = 'push_subscriptions_user_role_unique'
  ) THEN
    CREATE UNIQUE INDEX push_subscriptions_user_role_unique
      ON push_subscriptions (user_id, user_role);
  END IF;
END$$;

-- END 020_push_subscriptions_role.sql

-- =====================================================================
-- BEGIN 021_normalize_driver_mobile.sql
-- =====================================================================

-- Normalize driver mobile numbers: prepend 0 for numbers starting with 5
UPDATE drivers
SET mobile = '0' || mobile
WHERE mobile LIKE '5%';

-- END 021_normalize_driver_mobile.sql

-- =====================================================================
-- BEGIN 022_notification_targeting_and_interactions.sql
-- =====================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS action_label TEXT,
  ADD COLUMN IF NOT EXISTS action_payload JSONB,
  ADD COLUMN IF NOT EXISTS interacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS interaction_source TEXT,
  ADD COLUMN IF NOT EXISTS interaction_type TEXT;

CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON notifications(read_at);

CREATE INDEX IF NOT EXISTS notifications_interacted_at_idx
  ON notifications(interacted_at);

CREATE INDEX IF NOT EXISTS notifications_user_role_created_idx
  ON notifications(user_role, user_id, created_at DESC);

-- END 022_notification_targeting_and_interactions.sql

-- =====================================================================
-- BEGIN 023_drop_supabase_push_trigger.sql
-- =====================================================================

-- Migration: Remove broken Supabase push trigger
-- الـ trigger كان يبحث عن push_subscription في جدول clients/drivers القديم
-- لكن النظام الجديد يستخدم push_subscriptions table منفصل
-- الـ push يُرسل الآن من Render backend فقط عبر VAPID

-- حذف الـ trigger
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;

-- حذف الـ function
DROP FUNCTION IF EXISTS trigger_send_push_notification();

-- ملاحظة: يجب تشغيل هذا مباشرة في Supabase SQL Editor


-- END 023_drop_supabase_push_trigger.sql

-- =====================================================================
-- BEGIN 024_bank_accounts_int_id_seq.sql
-- =====================================================================

-- =====================================================================
-- Migration 024: Add sequence for bank_accounts.int_id
-- نظام توصّلني — تحويل bank_accounts.int_id إلى sequence آمن
-- =====================================================================
--
-- السبب: الكود السابق كان يحسب int_id بطريقة MAX+1 داخل SELECT
-- وهي غير آمنة عند الطلبات المتزامنة (race condition).
-- الحل: إنشاء sequence تضمن قيماً فريدة تحت أي ضغط.
--
-- Run via: psql "$DATABASE_URL" -f migrations/sql/024_bank_accounts_int_id_seq.sql
-- Or paste into Supabase SQL Editor
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Create the sequence (idempotent)
-- ─────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS bank_accounts_int_id_seq;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Seed the sequence to the current maximum so existing rows
--    are not duplicated.
-- ─────────────────────────────────────────────────────────────────────
SELECT setval(
  'bank_accounts_int_id_seq',
  COALESCE((SELECT MAX(int_id) FROM bank_accounts), 0)
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Wire the sequence as the column default.
--    Existing rows keep their current values.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE bank_accounts
  ALTER COLUMN int_id SET DEFAULT nextval('bank_accounts_int_id_seq');

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT last_value FROM bank_accounts_int_id_seq;
-- SELECT int_id FROM bank_accounts ORDER BY int_id DESC LIMIT 5;

-- END 024_bank_accounts_int_id_seq.sql

-- =====================================================================
-- BEGIN 025_pricing_engine_config.sql
-- =====================================================================

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

-- END 025_pricing_engine_config.sql

-- =====================================================================
-- BEGIN 026_activate_formula_v2.sql
-- =====================================================================

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

-- END 026_activate_formula_v2.sql

-- =====================================================================
-- BEGIN 027_request_manual_status_override.sql
-- =====================================================================

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS status_manually_set_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- END 027_request_manual_status_override.sql

-- =====================================================================
-- BEGIN 028_missing_indexes_performance.sql
-- =====================================================================

-- =====================================================================
-- Migration 028 — Missing performance indexes (no code changes)
-- المرحلة 2: الفهارس والأداء
-- =====================================================================
-- Adds indexes used by high-traffic admin/operations/push queries.
-- All indexes are idempotent via IF NOT EXISTS.

-- ── operations: unresolved errors and alerts streams ───────────────────
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved_created
  ON system_errors (resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_errors_severity_created
  ON system_errors (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_errors_open_dedupe
  ON system_errors (error_type, message, created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_system_alerts_unread_created
  ON system_alerts (is_read, created_at DESC);

-- ── admin recent-events feeds ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status_created
  ON wallet_transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_status_created
  ON offers (status, created_at DESC);

-- ── push debug / monitor role aggregation ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_role
  ON push_subscriptions (user_role);

-- END 028_missing_indexes_performance.sql

-- =====================================================================
-- BEGIN 029_pricing_matrix_rename_columns.sql
-- =====================================================================

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

-- END 029_pricing_matrix_rename_columns.sql

-- =====================================================================
-- BEGIN 030_transactions_type_enum.sql
-- =====================================================================

-- =====================================================================
-- Migration 030 — Add transaction_type enum to transactions table
--
-- Context: transactions.type was a free-text column, allowing any string.
-- This migration:
--   1. Creates the transaction_type enum (fee, credit, debit)
--   2. Migrates the existing TEXT column to use the new enum
--   3. Idempotent — safe to re-run
-- =====================================================================

-- Step 1: Create the enum type (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'transaction_type'
  ) THEN
    CREATE TYPE public.transaction_type AS ENUM ('fee', 'credit', 'debit');
  END IF;
END $$;

-- Step 2: Alter the column to use the enum
-- Uses USING cast — existing values 'fee', 'credit', 'debit' map directly
ALTER TABLE public.transactions
  ALTER COLUMN type TYPE public.transaction_type
    USING type::public.transaction_type;

-- Step 3: Ensure NOT NULL constraint is in place
ALTER TABLE public.transactions
  ALTER COLUMN type SET NOT NULL;

-- END 030_transactions_type_enum.sql

-- =====================================================================
-- BEGIN 031_pricing_matrix_numeric_types.sql
-- =====================================================================

-- =====================================================================
-- Migration 031 — Fix pricing_matrix monetary columns: real → numeric
--
-- Context: pricePerPerson and price_sar were stored as REAL (float4),
-- which causes floating-point rounding errors on financial values.
-- This migration converts them to NUMERIC(10,2) for exact precision.
-- Distance columns (distance_min_km, distance_max_km) are also
-- converted to NUMERIC(8,2) for consistency.
-- =====================================================================

-- Distance columns
ALTER TABLE public.pricing_matrix
  ALTER COLUMN distance_min_km TYPE NUMERIC(8,2)
    USING distance_min_km::NUMERIC(8,2);

ALTER TABLE public.pricing_matrix
  ALTER COLUMN distance_max_km TYPE NUMERIC(8,2)
    USING distance_max_km::NUMERIC(8,2);

-- Price columns
ALTER TABLE public.pricing_matrix
  ALTER COLUMN price_per_person TYPE NUMERIC(10,2)
    USING price_per_person::NUMERIC(10,2);

ALTER TABLE public.pricing_matrix
  ALTER COLUMN price_sar TYPE NUMERIC(10,2)
    USING price_sar::NUMERIC(10,2);

-- END 031_pricing_matrix_numeric_types.sql

-- =====================================================================
-- BEGIN 032_offers_unique_active_constraint.sql
-- =====================================================================

-- Migration: unique constraint on offers (driver_id, request_id) for active offers
-- Prevents race condition: duplicate bids from rapid double-clicks
-- Uses partial unique index (only on PENDING and SELECTED statuses)

CREATE UNIQUE INDEX IF NOT EXISTS offers_driver_request_active_unique
  ON offers (driver_id, request_id)
  WHERE status IN ('PENDING', 'SELECTED');

-- Comment: CANCELLED offers allow re-bidding (excluded from unique constraint)


-- END 032_offers_unique_active_constraint.sql

-- =====================================================================
-- BEGIN 033_request_routing_archive_and_notification_delivery.sql
-- =====================================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS duration_minutes double precision,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamp;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_channel_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_channel_check
      CHECK (channel IN ('in_app', 'push'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_delivery_status_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_delivery_status_check
      CHECK (delivery_status IN ('pending', 'delivered', 'failed'));
  END IF;
END $$;

-- END 033_request_routing_archive_and_notification_delivery.sql

-- =====================================================================
-- BEGIN 034_production_safe_missing_columns_backfill.sql
-- =====================================================================

-- =====================================================================
-- Migration 034 — Production-safe backfill for missing columns
-- Purpose: add only missing columns required by current API/server code.
-- Safe: idempotent (IF NOT EXISTS), no table recreation, no data deletion.
-- =====================================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS duration_minutes double precision,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamp,
  ADD COLUMN IF NOT EXISTS status_manually_set_by_admin boolean;

UPDATE requests
SET status_manually_set_by_admin = false
WHERE status_manually_set_by_admin IS NULL;

ALTER TABLE requests
  ALTER COLUMN status_manually_set_by_admin SET DEFAULT false;

ALTER TABLE requests
  ALTER COLUMN status_manually_set_by_admin SET NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamp,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_payload jsonb,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp,
  ADD COLUMN IF NOT EXISTS clicked_at timestamp,
  ADD COLUMN IF NOT EXISTS interacted_at timestamp,
  ADD COLUMN IF NOT EXISTS interaction_source text,
  ADD COLUMN IF NOT EXISTS interaction_type text,
  ADD COLUMN IF NOT EXISTS url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_channel_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_channel_check
      CHECK (channel IN ('in_app', 'push'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_delivery_status_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_delivery_status_check
      CHECK (delivery_status IN ('pending', 'delivered', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON notifications(read_at);

CREATE INDEX IF NOT EXISTS notifications_interacted_at_idx
  ON notifications(interacted_at);

CREATE INDEX IF NOT EXISTS notifications_user_role_created_idx
  ON notifications(user_role, user_id, created_at DESC);

-- END 034_production_safe_missing_columns_backfill.sql

