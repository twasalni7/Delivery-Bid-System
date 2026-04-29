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
--   2. تعيين إعدادات المشروع في SQL Editor (مرة واحدة):
--        ALTER DATABASE postgres
--          SET "app.settings.supabase_url" = 'https://<ref>.supabase.co';
--        ALTER DATABASE postgres
--          SET "app.settings.service_role_key" = '<service_role_key>';
--      ثم أعد تشغيل الاتصال (أو انتظر إعادة تشغيل pooler).
--
--   3. نشر Edge Function:
--        supabase functions deploy send-push-notification
--      أو عبر Supabase Dashboard → Edge Functions → Deploy.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add push_subscription JSONB column to profiles table
--    (لحفظ كائن PushSubscription لمستخدمي Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_subscription JSONB;

COMMENT ON COLUMN profiles.push_subscription IS
  'Web Push PushSubscription object { endpoint, keys: { p256dh, auth } }.'
  ' Populated after the user grants notification permission in the browser.';


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
  -- Read project settings configured via ALTER DATABASE … SET …
  _supabase_url     := current_setting('app.settings.supabase_url',     true);
  _service_role_key := current_setting('app.settings.service_role_key', true);

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
