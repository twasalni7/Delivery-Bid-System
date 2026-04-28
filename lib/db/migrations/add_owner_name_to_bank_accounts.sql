-- إضافة عمود owner_name لجدول bank_accounts
-- لتوحيد الاسم مع عمود account_holder_name الموجود

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- نسخ القيم الحالية من account_holder_name إلى owner_name
UPDATE bank_accounts
  SET owner_name = account_holder_name
  WHERE owner_name IS NULL;
