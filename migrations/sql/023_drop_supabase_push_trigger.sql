-- Migration: Remove broken Supabase push trigger
-- الـ trigger كان يبحث عن push_subscription في جدول clients/drivers القديم
-- لكن النظام الجديد يستخدم push_subscriptions table منفصل
-- الـ push يُرسل الآن من Render backend فقط عبر VAPID

-- حذف الـ trigger
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;

-- حذف الـ function
DROP FUNCTION IF EXISTS trigger_send_push_notification();

-- ملاحظة: يجب تشغيل هذا مباشرة في Supabase SQL Editor

