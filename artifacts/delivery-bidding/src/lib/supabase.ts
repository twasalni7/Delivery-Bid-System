/**
 * Supabase Client — توصّلني
 *
 * لتفعيل الاتصال المباشر بـ Supabase أضف المتغيرات التالية في ملف .env:
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 *
 * ملاحظة: يستخدم المشروع حالياً Express API + PostgreSQL (DrizzleORM) لتخزين البيانات.
 * جميع حقول النماذج مرتبطة بجداول قاعدة البيانات عبر hooks الـ API:
 *   - جدول requests  ← CreateRequest.tsx  (useCreateRequest)
 *   - جدول drivers   ← DriverDashboard.tsx (useGetDriverMe, useListRequests)
 *   - جدول offers    ← DriverDashboard.tsx (useListMyOffers, useWithdrawOffer)
 *   - جدول clients   ← ClientDashboard.tsx (useListRequests)
 *
 * يمكن استخدام Supabase Client بجانب API الحالي للاستعلامات المباشرة أو
 * Realtime subscriptions.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _supabase: SupabaseClient | null = null;

/**
 * Returns the Supabase client singleton.
 * Throws if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase غير مُهيأ. يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env"
    );
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}
