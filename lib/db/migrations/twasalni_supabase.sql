-- =====================================================
-- Twasalni — Supabase SQL Migration
-- نظام اشتراكات النقل الذكي "توصّلني"
-- =====================================================
-- تشغيل هذا الملف مباشرةً في Supabase SQL Editor
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. جدول profiles (الملفات الشخصية)
--    مرتبط بـ Supabase Auth — يُنشأ تلقائياً عند تسجيل المستخدم
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  role                TEXT NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'driver', 'admin')),
  phone               TEXT,
  push_subscription   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN profiles.push_subscription IS
  'Web Push PushSubscription object { endpoint, keys: { p256dh, auth } }.'
  ' Populated after the user grants notification permission in the browser.';

-- Row Level Security لجدول profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدم يقرأ ملفه الشخصي فقط"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "المستخدم يُنشئ ملفه الشخصي"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "المستخدم يعدّل ملفه الشخصي فقط"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- دالة تلقائية لإنشاء profile عند التسجيل
-- تقرأ full_name و role و phone من raw_user_meta_data الذي يُمرَّر عند signUp
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────
-- 2. جدول rides (طلبات المشاوير / الاشتراكات)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subscription_type   TEXT NOT NULL DEFAULT 'غيره',
  passengers_count    INTEGER NOT NULL DEFAULT 1,
  pickup_location     TEXT NOT NULL,
  dropoff_location    TEXT NOT NULL,
  waypoints           JSONB,
  working_days        TEXT,
  pickup_time         TEXT NOT NULL,
  return_time         TEXT,
  monthly_price       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security لجدول rides
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "العميل يقرأ طلباته"
  ON rides FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "العميل ينشئ طلب جديد"
  ON rides FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "السائقون يرون الطلبات المفتوحة"
  ON rides FOR SELECT
  USING (
    status = 'pending'
    OR auth.uid() = customer_id
  );

-- تفعيل Realtime لجدول rides
ALTER TABLE rides REPLICA IDENTITY FULL;
-- (أضف rides إلى قائمة supabase_realtime publication عبر لوحة التحكم أو الأمر التالي)
-- ALTER PUBLICATION supabase_realtime ADD TABLE rides;


-- ─────────────────────────────────────────────────────
-- 3. جدول bank_accounts (حسابات بنكية للإدارة)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                   SERIAL PRIMARY KEY,
  bank_name            TEXT NOT NULL,
  iban                 TEXT NOT NULL,
  account_holder_name  TEXT NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security لجدول bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- الجميع يقرأ الحسابات النشطة (لعرضها عند الدفع)
CREATE POLICY "يقرأ الحسابات النشطة"
  ON bank_accounts FOR SELECT
  USING (is_active = TRUE);

-- الإدارة فقط تعدّل (يُنفَّذ عبر service_role key)


-- ─────────────────────────────────────────────────────
-- 4. جدول wallet_transactions (عمليات شحن المحفظة)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL,
  receipt_url TEXT,
  status      wallet_transaction_status NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security لجدول wallet_transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- ملاحظة: يستخدم هذا النظام معرّفات صحيحة للسائقين (integer) مأخوذة من
-- جلسات Express وليس من Supabase Auth مباشرةً.
-- تُدار هذه العمليات عبر Express API (requireAuth middleware) الذي يتحقق
-- من هوية المستخدم قبل الوصول إلى البيانات.
-- الصلاحيات التالية تتيح الوصول عبر service_role key (API server) فقط،
-- بينما تمنع الوصول المباشر من العملاء غير الموثوقين.

-- السماح للـ API server (service_role) بالقراءة والكتابة الكاملة
-- (يُنفَّذ عبر SUPABASE_DATABASE_URL الخاصة بالخادم)


-- ─────────────────────────────────────────────────────
-- 5. Supabase Storage — bucket للإيصالات
-- ─────────────────────────────────────────────────────
-- تشغيل هذا الكود في Supabase Storage أو عبر API:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('receipts', 'receipts', false)
-- ON CONFLICT DO NOTHING;
--
-- CREATE POLICY "السائق يرفع إيصاله"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'receipts');
--
-- CREATE POLICY "الإدارة ترى الإيصالات"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'receipts');


-- ─────────────────────────────────────────────────────
-- 6. إنشاء مستخدم الإدارة (يُنفَّذ مرة واحدة بعد إعداد المشروع)
-- ─────────────────────────────────────────────────────
-- خطوات إنشاء حساب الإدارة:
--
-- أ) افتح Supabase Dashboard → Authentication → Users → "Add user" أو "Invite user"
--    البريد الإلكتروني : admin@twasalni.com
--    كلمة المرور      : استخدم كلمة مرور قوية وفريدة (لا تقل عن 12 حرفاً)
--    تأكيد البريد     : فعّل "Auto Confirm User" حتى لا يحتاج لتأكيد
--
-- ب) بعد إنشاء المستخدم في Auth، شغّل الأمر التالي في SQL Editor لإنشاء صف profiles
--    مع دور 'admin' (الـ trigger ينشئ الصف تلقائياً بدور 'customer' إذا لم تُمرَّر metadata،
--    لذا نُصحّح الدور هنا):
--
-- INSERT INTO profiles (id, full_name, role)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@twasalni.com' LIMIT 1),
--   'مشرف النظام',
--   'admin'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'مشرف النظام';
