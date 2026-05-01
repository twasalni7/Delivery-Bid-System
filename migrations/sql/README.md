# SQL Migrations

This directory contains incremental SQL migration files for the Twasalni (توصّلني) database.

> ⚠️ **Never run these directly on production without first testing on staging and taking a full database backup.**

## Files

| File | Purpose |
|------|---------|
| `001_enable_rls_and_policies.sql` | Enable Row Level Security on all tables and add deny-all policies for direct (non-API) access |
| `002_indexes_and_constraints.sql` | Add performance indexes and partial unique indexes to prevent data anomalies |
| `003_accept_offer_function.sql` | Atomic `accept_offer()` DB function that locks rows and performs the accept in a single transaction |
| `004_shifts_messages_live_support.sql` | Add `shifts` JSONB column to requests, `LIVE_SUPPORT` ticket status, and `messages` table for live chat |
| `005_push_subscription_webhook.sql` | Add `push_subscription JSONB` to `profiles`, enable `pg_net`, and create a DB trigger that calls the `send-push-notification` Supabase Edge Function on every `notifications` INSERT |
| `006_critical_fixes.sql` | Create `app_config` key-value table for application settings and set default bid fee |
| `007_pricing_and_coordinates.sql` | Add coordinate fields (lat/lng) and distance-based pricing with automatic admin review for 40km+ requests |

## Running migrations

### Prerequisites
- Take a Supabase snapshot (Dashboard → Settings → Database → Backups) **before** running.
- Or `pg_dump`:
  ```bash
  pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

### Apply (staging first)
```bash
psql "$DATABASE_URL" -f migrations/sql/001_enable_rls_and_policies.sql
psql "$DATABASE_URL" -f migrations/sql/002_indexes_and_constraints.sql
psql "$DATABASE_URL" -f migrations/sql/003_accept_offer_function.sql
psql "$DATABASE_URL" -f migrations/sql/004_shifts_messages_live_support.sql
psql "$DATABASE_URL" -f migrations/sql/005_push_subscription_webhook.sql
psql "$DATABASE_URL" -f migrations/sql/006_critical_fixes.sql
psql "$DATABASE_URL" -f migrations/sql/007_pricing_and_coordinates.sql
```

Or via Supabase SQL Editor: paste each file's content and run.

### Verify

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;

-- Check policies
SELECT schemaname, tablename, policyname, cmd, roles
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;

-- Check indexes
SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;

-- Check accept_offer function exists
SELECT proname FROM pg_proc
  WHERE proname = 'accept_offer'
    AND pronamespace = 'public'::regnamespace;
```

## Rollback

```bash
# Disable RLS (reverses 001)
psql "$DATABASE_URL" -c "
  ALTER TABLE admins              DISABLE ROW LEVEL SECURITY;
  ALTER TABLE clients             DISABLE ROW LEVEL SECURITY;
  ALTER TABLE drivers             DISABLE ROW LEVEL SECURITY;
  ALTER TABLE requests            DISABLE ROW LEVEL SECURITY;
  ALTER TABLE offers              DISABLE ROW LEVEL SECURITY;
  ALTER TABLE support_tickets     DISABLE ROW LEVEL SECURITY;
  ALTER TABLE transactions        DISABLE ROW LEVEL SECURITY;
  ALTER TABLE wallet_transactions DISABLE ROW LEVEL SECURITY;
  ALTER TABLE bank_accounts       DISABLE ROW LEVEL SECURITY;
  ALTER TABLE notifications       DISABLE ROW LEVEL SECURITY;
"

# Drop indexes (reverses 002)
psql "$DATABASE_URL" -c "
  DROP INDEX IF EXISTS idx_requests_client_id;
  DROP INDEX IF EXISTS idx_requests_status_created;
  DROP INDEX IF EXISTS idx_requests_selected_driver;
  DROP INDEX IF EXISTS idx_offers_request_id;
  DROP INDEX IF EXISTS idx_offers_driver_id;
  DROP INDEX IF EXISTS idx_notifications_user;
  DROP INDEX IF EXISTS idx_notifications_unread;
  DROP INDEX IF EXISTS idx_transactions_driver_id;
  DROP INDEX IF EXISTS idx_wallet_transactions_driver_id;
  DROP INDEX IF EXISTS idx_support_tickets_client_id;
  DROP INDEX IF EXISTS idx_support_tickets_driver_id;
  DROP INDEX IF EXISTS unique_request_selected_offer;
  DROP INDEX IF EXISTS unique_driver_request_pending_offer;
"

# Drop function (reverses 003)
psql "$DATABASE_URL" -c "DROP FUNCTION IF EXISTS public.accept_offer(INTEGER, INTEGER, INTEGER, REAL);"

# Reverse migration 005
psql "$DATABASE_URL" -c "
  DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;
  DROP FUNCTION IF EXISTS public.trigger_send_push_notification();
  ALTER TABLE profiles DROP COLUMN IF EXISTS push_subscription;
"
# Optionally drop pg_net if it was not in use before migration 005:
# psql "$DATABASE_URL" -c "DROP EXTENSION IF EXISTS pg_net CASCADE;"
```
