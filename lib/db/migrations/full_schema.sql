-- =====================================================
-- Twasalni — Full Schema Migration
-- نظام اشتراكات النقل الذكي "توصّلني"
-- =====================================================
--
-- ⚠️  تحذير مهم:
--     لا تُشغّل ملف twasalni_supabase.sql القديم — إنه متقادم
--     ومبني على Supabase Auth / UUID ولم يعد يتوافق مع النظام الحالي.
--     شغّل هذا الملف فقط على قاعدة بيانات فارغة جديدة.
--
-- ترتيب التنفيذ:
--   1. Enums
--   2. الجداول الأساسية (بدون foreign keys): المشرفون, clients, drivers
--   3. الجداول المرتبطة: requests, offers, support_tickets,
--                        transactions, wallet_transactions,
--                        bank_accounts, notifications
--   4. Indexes
--   5. Seed: أول مشرف
-- =====================================================


-- ─────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'OPEN', 'SELECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FROZEN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM (
    'موظفات', 'طلاب', 'مدارس', 'جامعات', 'معلمات', 'غيره'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM ('PENDING', 'SELECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_type AS ENUM ('تأخير', 'دفع', 'إلغاء', 'أخرى');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────
-- 2. الجداول الأساسية
-- ─────────────────────────────────────────────────────

-- 2a. المشرفون
CREATE TABLE IF NOT EXISTS "المشرفون" (
  id                SERIAL PRIMARY KEY,
  name              TEXT        NOT NULL,
  login_code        TEXT        NOT NULL UNIQUE,
  push_subscription TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2b. clients (العملاء)
CREATE TABLE IF NOT EXISTS clients (
  id                SERIAL PRIMARY KEY,
  name              TEXT        NOT NULL,
  mobile            TEXT        NOT NULL UNIQUE,
  password_hash     TEXT        NOT NULL,
  push_subscription TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2c. drivers (السائقون)
CREATE TABLE IF NOT EXISTS drivers (
  id                SERIAL PRIMARY KEY,
  name              TEXT          NOT NULL,
  mobile            TEXT          NOT NULL,
  login_code        TEXT          NOT NULL,
  balance           REAL          NOT NULL DEFAULT 0,
  car_type          TEXT,
  nationality       TEXT,
  age               INTEGER,
  national_id       TEXT,
  status            driver_status NOT NULL DEFAULT 'ACTIVE',
  warning_count     INTEGER       NOT NULL DEFAULT 0,
  push_subscription TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────
-- 3. الجداول المرتبطة
-- ─────────────────────────────────────────────────────

-- 3a. requests (طلبات النقل)
CREATE TABLE IF NOT EXISTS requests (
  id                   SERIAL PRIMARY KEY,
  client_id            INTEGER        REFERENCES clients(id),
  client_type          client_type    NOT NULL DEFAULT 'غيره',
  home_location        TEXT           NOT NULL,
  work_location        TEXT           NOT NULL,
  additional_locations JSONB,
  phone                TEXT           NOT NULL,
  number_of_people     INTEGER        NOT NULL DEFAULT 1,
  working_days_per_week INTEGER       NOT NULL DEFAULT 5,
  number_of_shifts     INTEGER        NOT NULL DEFAULT 1,
  morning_time         TEXT           NOT NULL,
  evening_time         TEXT,
  notes                TEXT,
  monthly_price        REAL           NOT NULL DEFAULT 0,
  status               request_status NOT NULL DEFAULT 'OPEN',
  selected_driver_id   INTEGER        REFERENCES drivers(id),
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 3b. offers (العروض من السائقين)
CREATE TABLE IF NOT EXISTS offers (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER      NOT NULL REFERENCES drivers(id),
  request_id  INTEGER      NOT NULL REFERENCES requests(id),
  status      offer_status NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3c. support_tickets (تذاكر الدعم)
CREATE TABLE IF NOT EXISTS support_tickets (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER        REFERENCES clients(id),
  driver_id    INTEGER        REFERENCES drivers(id),
  request_id   INTEGER        REFERENCES requests(id),
  type         ticket_type    NOT NULL,
  message      TEXT           NOT NULL,
  status       ticket_status  NOT NULL DEFAULT 'OPEN',
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 3d. transactions (سجل المعاملات المالية للسائقين)
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER     NOT NULL REFERENCES drivers(id),
  amount      REAL        NOT NULL,
  type        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3e. wallet_transactions (طلبات شحن المحفظة)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER                   NOT NULL REFERENCES drivers(id),
  amount      NUMERIC(10, 2)            NOT NULL,
  receipt_url TEXT,
  status      wallet_transaction_status NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

-- 3f. bank_accounts (الحسابات البنكية للإدارة)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                   SERIAL PRIMARY KEY,
  bank_name            TEXT        NOT NULL,
  iban                 TEXT        NOT NULL,
  account_holder_name  TEXT        NOT NULL,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3g. notifications (الإشعارات)
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL,
  user_role   TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  related_id  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS drivers_mobile_unique
  ON drivers (mobile);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_login_code_unique
  ON drivers (login_code);


-- ─────────────────────────────────────────────────────
-- 5. Seed: أول مشرف
-- ─────────────────────────────────────────────────────
--
-- غيّر القيم أدناه قبل التشغيل، خاصةً login_code،
-- واحرص على تخزينه في مكان آمن.
--
-- INSERT INTO "المشرفون" (name, login_code)
-- VALUES ('مشرف النظام', 'CHANGE_ME_STRONG_CODE')
-- ON CONFLICT (login_code) DO NOTHING;
