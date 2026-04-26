-- =====================================================
-- Twasalni — Migration: Add push_subscription columns
-- تاريخ: 2026-04-25
-- أضف عمود push_subscription لحفظ اشتراكات إشعارات PWA
-- =====================================================
-- تشغيل هذا الملف مباشرةً في Supabase SQL Editor أو على قاعدة البيانات
-- =====================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS push_subscription TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS push_subscription TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS push_subscription TEXT;
