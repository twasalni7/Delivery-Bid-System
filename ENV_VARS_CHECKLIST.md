# ✅ قائمة التحقق السريعة - متغيرات البيئة للإنتاج

## 🎯 متغيرات إلزامية (يجب وجودها)

### 1. قاعدة البيانات
```bash
SUPABASE_DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@xxx.pooler.supabase.com:6543/postgres
```
- ✅ يجب استخدام **Transaction Pooler** (منفذ **6543**)
- ✅ استبدل `[YOUR-PASSWORD]` بكلمة المرور الفعلية
- ❌ لا تستخدم المنفذ 5432 (Direct Connection)

**أين تجده:**
Supabase → Settings → Database → Connection string → **Transaction Pooler**

---

### 2. سر الجلسة
```bash
SESSION_SECRET=a-long-random-secret-string-at-least-32-characters
```
- ✅ يجب أن يكون **32 حرف على الأقل**
- ✅ يجب أن يكون **عشوائي وآمن**
- ❌ لا تستخدم "change-me" أو أي قيمة افتراضية

**كيف تولده:**
```bash
openssl rand -hex 32
```

---

### 3. بيئة الإنتاج
```bash
NODE_ENV=production
```
- ✅ يجب أن تكون **بالضبط** `production`
- ❌ لا تستخدم `development` أو أي قيمة أخرى

---

### 4. مفتاح OpenRouteService (مهم جداً!)
```bash
OPENROUTESERVICE_API_KEY=your-actual-api-key-here
```
- ✅ **بدون هذا المفتاح، لن يعمل حساب المسافة والتسعير!**
- ✅ احصل عليه من [openrouteservice.org](https://openrouteservice.org)
- ✅ الخطة المجانية تعطيك 2000 طلب يومياً

**كيف تحصل عليه:**
1. اذهب إلى openrouteservice.org
2. Sign Up (مجاني)
3. Dashboard → Tokens
4. Request a token (Free plan)
5. انسخ الـ API Key

**اختبار المفتاح:**
```bash
curl "https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_KEY&start=8.681495,49.41461&end=8.687872,49.420318"
```
إذا نجح، سترى JSON response. إذا فشل، المفتاح خاطئ.

---

## 🔧 متغيرات اختيارية (لكن موصى بها)

### 5. Web Push / VAPID للإشعارات

```bash
# Generate VAPID keys using:
# pnpm --filter @workspace/scripts run generate-vapid

VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@twasalni.app
```
- بدونها: الإشعارات Push لن تعمل
- معها: الإشعارات ستصل للمستخدمين

---

### 6. Sentry للمراقبة
```bash
VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```
- بدونها: الأخطاء ستُسجّل في الـ Logs فقط
- معها: ستحصل على تنبيهات فورية عند الأخطاء

---

## 📋 قائمة تحقق سريعة

نسخ والصق هذا في Render Dashboard → Environment Variables:

```
✅ SUPABASE_DATABASE_URL    → رابط Transaction Pooler (منفذ 6543)
✅ SESSION_SECRET           → من openssl rand -hex 32
✅ NODE_ENV                 → production
✅ OPENROUTESERVICE_API_KEY → من openrouteservice.org

(اختياري)
⚪ ONESIGNAL_APP_ID
⚪ ONESIGNAL_REST_API_KEY
⚪ VITE_SENTRY_DSN
⚪ PORT                     → 10000 (Render يعيّنه تلقائياً)
```

---

## 🚨 أخطاء شائعة

### ❌ "openrouteservice_not_configured"
**السبب:** `OPENROUTESERVICE_API_KEY` مفقود أو خاطئ
**الحل:** تحقق من المفتاح على openrouteservice.org

### ❌ "Connection refused"
**السبب:** `SUPABASE_DATABASE_URL` يستخدم المنفذ الخاطئ
**الحل:** استخدم Transaction Pooler (منفذ 6543)

### ❌ "Session secret required"
**السبب:** `SESSION_SECRET` مفقود
**الحل:** أضف سر طويل وعشوائي

### ❌ التسعير لا يظهر
**السبب:** `OPENROUTESERVICE_API_KEY` مفقود
**الحل:** أضف المفتاح وأعد التشغيل

---

## ✅ اختبار النجاح

بعد إضافة جميع المتغيرات، افتح:

```
https://your-app.onrender.com/api/healthz
```

يجب أن ترى:
```json
{"status":"ok"}
```

ثم جرّب:
```
https://your-app.onrender.com/api/readyz
```

يجب أن ترى:
```json
{"ready":true}
```

إذا رأيت `"ready":false`، تحقق من:
1. `SUPABASE_DATABASE_URL` صحيح
2. قاعدة البيانات تعمل
3. `SESSION_SECRET` موجود

---

## 🎯 الخلاصة

**المتغيرات الأربعة الإلزامية:**
1. `SUPABASE_DATABASE_URL` ← قاعدة البيانات
2. `SESSION_SECRET` ← الأمان
3. `NODE_ENV=production` ← البيئة
4. `OPENROUTESERVICE_API_KEY` ← حساب المسافة والتسعير

**بدون هذه الأربعة، النظام لن يعمل!** ✅
