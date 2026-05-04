-- =============================================================
--  FULL SCHEMA  –  Delivery Bid System (توصّلني)
--  Run this once on a fresh Supabase / PostgreSQL database.
--  All tables, enums, indexes, constraints and default data.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()


-- ──────────────────────────────────────────────────────────────
-- 1. ENUM TYPES
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'OPEN', 'SELECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FROZEN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM (
    'موظفات', 'طلاب', 'مدارس', 'جامعات', 'معلمات', 'غيره'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM ('PENDING', 'SELECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_type AS ENUM ('تأخير', 'دفع', 'إلغاء', 'أخرى');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM (
    'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'LIVE_SUPPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_transaction_status AS ENUM (
    'pending', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ──────────────────────────────────────────────────────────────

-- ── admins ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id              SERIAL PRIMARY KEY,
  name            TEXT        NOT NULL,
  login_code      TEXT        NOT NULL UNIQUE,
  push_subscription TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── clients ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              SERIAL PRIMARY KEY,
  name            TEXT        NOT NULL,
  mobile          TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  push_subscription TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── drivers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id              SERIAL PRIMARY KEY,
  name            TEXT           NOT NULL,
  mobile          TEXT           NOT NULL,
  login_code      TEXT           NOT NULL,
  balance         REAL           NOT NULL DEFAULT 0,
  car_type        TEXT,
  nationality     TEXT,
  age             INTEGER,
  national_id     TEXT,
  status          driver_status  NOT NULL DEFAULT 'ACTIVE',
  warning_count   INTEGER        NOT NULL DEFAULT 0,
  push_subscription TEXT,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_mobile_unique    ON drivers (mobile);
CREATE UNIQUE INDEX IF NOT EXISTS drivers_login_code_unique ON drivers (login_code);


-- ── requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id                  SERIAL PRIMARY KEY,
  client_id           INTEGER REFERENCES clients(id),
  client_type         client_type    NOT NULL DEFAULT 'غيره',
  home_location       TEXT           NOT NULL,
  work_location       TEXT           NOT NULL,
  additional_locations JSONB,            -- [{type:"pickup"|"dropoff", address:string}]
  shifts              JSONB,            -- [{label?:string, goTime:string, returnTime?:string}]
  phone               TEXT           NOT NULL,
  number_of_people    INTEGER        NOT NULL DEFAULT 1,
  working_days_per_week INTEGER      NOT NULL DEFAULT 5,
  number_of_shifts    INTEGER        NOT NULL DEFAULT 1,
  morning_time        TEXT           NOT NULL,
  evening_time        TEXT,
  notes               TEXT,
  home_lat            DOUBLE PRECISION,
  home_lng            DOUBLE PRECISION,
  dest_lat            DOUBLE PRECISION,
  dest_lng            DOUBLE PRECISION,
  distance_km         REAL,
  needs_admin_review  BOOLEAN        NOT NULL DEFAULT FALSE,
  monthly_price       REAL           NOT NULL DEFAULT 0,
  status              request_status NOT NULL DEFAULT 'OPEN',
  selected_driver_id  INTEGER REFERENCES drivers(id),
  created_by          TEXT           NOT NULL DEFAULT 'client',
  created_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── request_stops  (multi-point route waypoints) ───────────────
CREATE TABLE IF NOT EXISTS request_stops (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stop_order  INTEGER        NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  address     TEXT           NOT NULL,
  stop_type   TEXT           NOT NULL DEFAULT 'waypoint',
  created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── offers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER        NOT NULL REFERENCES drivers(id),
  request_id  INTEGER        NOT NULL REFERENCES requests(id),
  status      offer_status   NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS offers_driver_request_unique
  ON offers (driver_id, request_id);


-- ──────────────────────────────────────────────────────────────
-- 3. FINANCIAL TABLES
-- ──────────────────────────────────────────────────────────────

-- ── transactions  (balance top-ups & bid-fee deductions) ──────
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  driver_id   INTEGER NOT NULL REFERENCES drivers(id),
  amount      REAL    NOT NULL,
  type        TEXT    NOT NULL,            -- 'credit' | 'debit' | 'bid_fee' | ...
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── wallet_transactions  (charge requests with receipt) ───────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          SERIAL PRIMARY KEY,
  int_id      INTEGER        NOT NULL UNIQUE,
  driver_id   INTEGER        NOT NULL REFERENCES drivers(id),
  amount      NUMERIC(10,2)  NOT NULL,
  receipt_url TEXT,
  status      wallet_transaction_status NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── bank_accounts  (payment destinations shown to drivers) ────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                   SERIAL PRIMARY KEY,
  int_id               INTEGER  NOT NULL UNIQUE,
  bank_name            TEXT     NOT NULL,
  iban                 TEXT     NOT NULL,
  account_holder_name  TEXT     NOT NULL,
  account_number       TEXT,
  is_active            BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 4. COMMUNICATION TABLES
-- ──────────────────────────────────────────────────────────────

-- ── messages  (in-app chat per request) ───────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender_role TEXT    NOT NULL,          -- 'client' | 'driver' | 'admin'
  sender_id   INTEGER NOT NULL,
  body        TEXT    NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  user_role   TEXT    NOT NULL,          -- 'client' | 'driver' | 'admin'
  title       TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  related_id  INTEGER,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── push_subscriptions  (Web Push endpoints per user) ─────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  subscription_data JSONB   NOT NULL
);

-- ── support_tickets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER REFERENCES clients(id),
  driver_id   INTEGER REFERENCES drivers(id),
  request_id  INTEGER REFERENCES requests(id),
  type        ticket_type   NOT NULL,
  message     TEXT          NOT NULL,
  status      ticket_status NOT NULL DEFAULT 'OPEN',
  admin_reply TEXT,
  created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 5. PRICING & CONFIGURATION
-- ──────────────────────────────────────────────────────────────

-- ── app_config  (key-value settings store) ────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── pricing_matrix ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_matrix (
  id               SERIAL PRIMARY KEY,
  distance_min_km  REAL    NOT NULL,
  distance_max_km  REAL    NOT NULL,
  passengers_min   INTEGER NOT NULL,
  price_per_person REAL    NOT NULL,
  price_sar        REAL,                 -- total route price (base for 1 passenger)
  passengers_max   INTEGER DEFAULT 4,
  trip_type        TEXT,                 -- 'one_way' | 'round_trip'
  days_per_week_min INTEGER,
  days_per_week_max INTEGER
);

-- ── service_areas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_areas (
  id          SERIAL PRIMARY KEY,
  city        TEXT    NOT NULL,
  district    TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 6. AUTHENTICATION
-- ──────────────────────────────────────────────────────────────

-- ── user_tokens  (Bearer token auth – 30d expiry) ─────────────
CREATE TABLE IF NOT EXISTS user_tokens (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  role        TEXT    NOT NULL,           -- 'client' | 'driver' | 'admin'
  name        TEXT    NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 7. MONITORING & OPERATIONS
-- ──────────────────────────────────────────────────────────────

-- ── activity_logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    INTEGER,
  actor_role  TEXT      NOT NULL DEFAULT 'system',
  action      TEXT      NOT NULL,
  entity      TEXT      NOT NULL,
  entity_id   INTEGER,
  metadata    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── system_alerts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_alerts (
  id          SERIAL PRIMARY KEY,
  type        TEXT      NOT NULL,
  message     TEXT      NOT NULL,
  severity    TEXT      NOT NULL DEFAULT 'warning',
  is_read     TEXT      NOT NULL DEFAULT 'false',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── system_errors ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_errors (
  id          SERIAL PRIMARY KEY,
  error_type  TEXT      NOT NULL,
  message     TEXT      NOT NULL,
  stack       TEXT,
  page        TEXT,
  user_id     INTEGER,
  user_role   TEXT,
  count       INTEGER   NOT NULL DEFAULT 1,
  severity    TEXT      NOT NULL DEFAULT 'error',
  resolved    TEXT      NOT NULL DEFAULT 'false',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 8. INDEXES (performance)
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_requests_status          ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_client_id       ON requests (client_id);
CREATE INDEX IF NOT EXISTS idx_requests_selected_driver ON requests (selected_driver_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at      ON requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_request_id        ON offers (request_id);
CREATE INDEX IF NOT EXISTS idx_offers_driver_id         ON offers (driver_id);
CREATE INDEX IF NOT EXISTS idx_offers_status            ON offers (status);

CREATE INDEX IF NOT EXISTS idx_transactions_driver_id   ON transactions (driver_id);

CREATE INDEX IF NOT EXISTS idx_messages_request_id      ON messages (request_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications (user_id, user_role);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor      ON activity_logs (actor_id, actor_role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity     ON activity_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created    ON activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tokens_expires      ON user_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_request_stops_request    ON request_stops (request_id, stop_order);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_driver         ON wallet_transactions (driver_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status         ON wallet_transactions (status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client   ON support_tickets (client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_driver   ON support_tickets (driver_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets (status);


-- ──────────────────────────────────────────────────────────────
-- 9. USEFUL VIEW
-- ──────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_pricing_lookup;
CREATE VIEW v_pricing_lookup AS
SELECT
  pm.id,
  pm.distance_min_km,
  pm.distance_max_km,
  pm.passengers_min,
  pm.passengers_max,
  pm.price_per_person,
  pm.price_sar,
  pm.trip_type,
  pm.days_per_week_min,
  pm.days_per_week_max
FROM pricing_matrix pm
ORDER BY pm.distance_min_km, pm.passengers_min;


-- ──────────────────────────────────────────────────────────────
-- 10. ROW-LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on all user-facing tables
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_stops        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_matrix       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_errors        ENABLE ROW LEVEL SECURITY;

-- Block direct anon / authenticated access — API server uses service_role which bypasses RLS
CREATE POLICY "deny_anon" ON clients             FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON drivers             FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON admins              FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON requests            FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON request_stops       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON offers              FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON transactions        FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON wallet_transactions FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON bank_accounts       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON messages            FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON notifications       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON push_subscriptions  FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON support_tickets     FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON app_config          FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON pricing_matrix      FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON service_areas       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON user_tokens         FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON activity_logs       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON system_alerts       FOR ALL TO anon             USING (false);
CREATE POLICY "deny_anon" ON system_errors       FOR ALL TO anon             USING (false);

CREATE POLICY "deny_auth" ON clients             FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON drivers             FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON admins              FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON requests            FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON request_stops       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON offers              FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON transactions        FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON wallet_transactions FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON bank_accounts       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON messages            FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON notifications       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON push_subscriptions  FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON support_tickets     FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON app_config          FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON pricing_matrix      FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON service_areas       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON user_tokens         FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON activity_logs       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON system_alerts       FOR ALL TO authenticated    USING (false);
CREATE POLICY "deny_auth" ON system_errors       FOR ALL TO authenticated    USING (false);


-- ──────────────────────────────────────────────────────────────
-- 11. DEFAULT CONFIGURATION DATA
-- ──────────────────────────────────────────────────────────────

INSERT INTO app_config (key, value) VALUES
  ('bid_fee',               '50'),
  ('proximity_home_km',     '2'),
  ('proximity_work_km',     '2'),
  ('proximity_time_minutes','30')
ON CONFLICT (key) DO NOTHING;
