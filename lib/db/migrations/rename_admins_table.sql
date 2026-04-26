-- =====================================================
-- Twasalni — Migration: Rename admins table
-- تاريخ: 2026-04-26
-- =====================================================
-- يُعيد تسمية جدول "المشرفون" إلى "admins" إن وُجد
-- شغّل هذا الملف مرة واحدة على قاعدة البيانات الحالية
-- =====================================================

-- إعادة تسمية جدول المشرفين من الاسم العربي القديم إلى الإنجليزي
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'المشرفون'
  ) THEN
    ALTER TABLE "المشرفون" RENAME TO admins;
  END IF;
END
$$;
