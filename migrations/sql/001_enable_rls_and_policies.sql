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
