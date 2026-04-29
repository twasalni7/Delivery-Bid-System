-- =====================================================
-- Twasalni — Migration: Add push_subscriptions table
-- تاريخ: 2026-04-29
-- جدول مركزي لحفظ اشتراكات Web Push لجميع المستخدمين
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subscription_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);
