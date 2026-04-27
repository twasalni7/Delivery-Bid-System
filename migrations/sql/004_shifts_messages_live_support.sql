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
