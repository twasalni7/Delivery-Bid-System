-- إضافة عمود created_by لجدول requests
-- يُميّز بين الطلبات التي أنشأها العميل والطلبات التي أنشأتها الإدارة

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'client';
