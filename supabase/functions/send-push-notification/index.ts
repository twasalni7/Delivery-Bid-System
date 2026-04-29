/**
 * send-push-notification — Supabase Edge Function
 *
 * يُستدعى عبر HTTP POST من trigger قاعدة البيانات عند إضافة
 * صف جديد في جدول notifications، ويرسل Web Push Notification
 * للمستخدم المعني باستخدام مكتبة web-push ومفاتيح VAPID.
 *
 * متغيرات البيئة المطلوبة (Supabase Dashboard → Project Settings → Edge Functions Secrets):
 *   VAPID_PUBLIC_KEY        مفتاح VAPID العام
 *   VAPID_PRIVATE_KEY       مفتاح VAPID الخاص
 *   VAPID_SUBJECT           عنوان mailto: أو URL (اختياري، الافتراضي: mailto:admin@twasalni.app)
 *   SUPABASE_URL            رابط مشروع Supabase  (متاح تلقائياً داخل Edge Functions)
 *   SUPABASE_SERVICE_ROLE_KEY مفتاح service_role  (متاح تلقائياً داخل Edge Functions)
 */

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── VAPID setup ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@twasalni.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Map notification user_role → table name.
 *  These tables store push_subscription as TEXT (JSON string) via the
 *  add_push_subscription migration (lib/db/migrations/add_push_subscription.sql).
 *  The profiles table (Supabase Auth) stores it as JSONB and is handled separately.
 */
const TABLE_MAP: Record<string, string> = {
  client: "clients",
  driver: "drivers",
  admin: "admins",
};

/** Shape of the NEW row from the notifications table trigger payload */
interface NotificationRecord {
  id: number;
  user_id: number;
  user_role: string;
  title: string;
  message: string;
  type: string;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}

/** Webhook payload sent by the pg_net trigger */
interface WebhookPayload {
  record?: NotificationRecord;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const record = payload.record;
  if (!record) {
    // Nothing to do — return 200 so the trigger doesn't retry
    return new Response("OK: no record", { status: 200 });
  }

  const { user_id: userId, user_role: userRole, title, message } = record;

  if (!userId || !userRole) {
    return new Response("OK: missing user fields", { status: 200 });
  }

  // ── Guard: VAPID keys must be configured ─────────────────────────────────
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured — skipping push");
    return new Response("Push not configured", { status: 503 });
  }

  // ── Look up push_subscription for the user ────────────────────────────────
  const table = TABLE_MAP[userRole];
  if (!table) {
    return new Response("OK: unknown role", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from(table)
    .select("push_subscription")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch push_subscription:", error.message);
    return new Response("OK: db error", { status: 200 });
  }

  // push_subscription is stored as TEXT (JSON string) in clients/drivers/admins tables.
  // Supabase returns it as a string, so JSON.parse is required here.
  const pushSubscriptionJson = (
    data as { push_subscription: string | null } | null
  )?.push_subscription;

  if (!pushSubscriptionJson) {
    // User hasn't granted notification permission yet — nothing to do
    return new Response("OK: no subscription", { status: 200 });
  }

  // ── Send Web Push ─────────────────────────────────────────────────────────
  try {
    const subscription = JSON.parse(
      pushSubscriptionJson
    ) as webpush.PushSubscription;

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: title ?? "توصّلني",
        body: message ?? "",
        url: "/",
      })
    );
  } catch (err) {
    // Silent — push failures are non-critical (subscription may have expired)
    console.warn("sendNotification failed:", (err as Error).message);
  }

  return new Response("OK", { status: 200 });
});
