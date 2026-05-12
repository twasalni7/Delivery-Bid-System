# 🚀 دليل النشر الكامل على الإنتاج - مشروع توصّلني

## 📋 نظرة عامة

هذا الدليل يشرح خطوة بخطوة كيفية نشر مشروع توصّلني على الإنتاج باستخدام:
- **Render** للـ Backend/API Server
- **Vercel** للـ Frontend (اختياري)
- **Supabase** لقاعدة البيانات PostgreSQL

---

## 🔑 الجزء الأول: إعداد قاعدة البيانات (Supabase)

### الخطوة 1: إنشاء مشروع Supabase

1. افتح [supabase.com](https://supabase.com)
2. سجّل الدخول أو أنشئ حساب جديد
3. اضغط **New Project**
4. اختر اسم المشروع: `twasalni-production`
5. اختر كلمة مرور قوية للـ Database
6. اختر المنطقة الأقرب لك (مثل `West EU` أو `Central US`)
7. اضغط **Create new project**
8. انتظر حتى يكتمل إنشاء المشروع (2-3 دقائق)

### الخطوة 2: الحصول على رابط الاتصال (Connection String)

1. في لوحة تحكم Supabase، اذهب إلى **Settings** (أيقونة الترس)
2. اضغط على **Database**
3. ابحث عن قسم **Connection string**
4. اختر **Transaction Pooler** (مهم جداً!)
5. سترى رابط مثل:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
6. **استبدل `[YOUR-PASSWORD]`** بكلمة المرور التي اخترتها عند إنشاء المشروع
7. احفظ هذا الرابط - ستحتاجه لاحقاً

### الخطوة 3: تطبيق الـ Migrations (36 ملف)

هناك **36 migration file** يجب تطبيقها على قاعدة البيانات:

#### الطريقة الأولى: باستخدام SQL Editor في Supabase (موصى بها)

1. في لوحة تحكم Supabase، اذهب إلى **SQL Editor**
2. افتح كل ملف من ملفات الـ migrations في المجلد `migrations/sql/`
3. انسخ محتوى الملف والصقه في SQL Editor
4. اضغط **Run**
5. كرر الخطوات للملفات بالترتيب التالي:

```
000_full_schema.sql                          ← الأساس: إنشاء جميع الجداول
001_enable_rls_and_policies.sql              ← الأمان: Row Level Security
002_indexes_and_constraints.sql              ← الأداء: الفهارس
003_accept_offer_function.sql                ← دالة قبول العرض
004_shifts_messages_live_support.sql         ← الورديات والرسائل
005_push_subscription_webhook.sql            ← الإشعارات
006_critical_fixes.sql                       ← إصلاحات حرجة
007_pricing_and_coordinates.sql              ← التسعير والإحداثيات
008_pricing_config.sql                       ← إعدادات التسعير
009_activity_logs_and_service_areas.sql      ← سجل النشاط والمناطق
010_pricing_matrix.sql                       ← جدول التسعير
011_pricing_matrix_price_sar.sql             ← أسعار بالريال
012_fix_activity_logs_id_types.sql           ← إصلاح أنواع البيانات
013_user_tokens.sql                          ← رموز المستخدمين
014_user_tokens_rls.sql                      ← أمان الرموز
015_operations_monitoring.sql                ← مراقبة العمليات
016_request_passengers.sql                   ← الركاب
017_notification_tracking.sql                ← تتبع الإشعارات
018_financial_integrity.sql                  ← السلامة المالية
019_code_compat_fixes.sql                    ← إصلاحات التوافق
020_push_subscriptions_role.sql              ← اشتراكات الإشعارات
021_normalize_driver_mobile.sql              ← تنسيق رقم الهاتف
022_notification_targeting_and_interactions.sql  ← استهداف الإشعارات
023_drop_supabase_push_trigger.sql           ← حذف trigger قديم
024_bank_accounts_int_id_seq.sql             ← الحسابات البنكية
025_pricing_engine_config.sql                ← محرك التسعير
026_activate_formula_v2.sql                  ← تفعيل معادلة V2
027_request_manual_status_override.sql       ← تغيير الحالة يدوياً
028_missing_indexes_performance.sql          ← فهارس إضافية
029_pricing_matrix_rename_columns.sql        ← إعادة تسمية الأعمدة
030_transactions_type_enum.sql               ← أنواع المعاملات
031_pricing_matrix_numeric_types.sql         ← أنواع رقمية
032_offers_unique_active_constraint.sql      ← قيد فريد للعروض
033_request_routing_archive_and_notification_delivery.sql  ← الأرشفة والتوصيل
034_production_safe_missing_columns_backfill.sql  ← ملء الأعمدة الناقصة
```

#### الطريقة الثانية: باستخدام سطر الأوامر (للمطورين)

```bash
# تعيين متغير البيئة
export SUPABASE_DATABASE_URL="postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# تطبيق جميع الملفات بالترتيب
cd migrations/sql
for file in *.sql; do
  echo "تطبيق: $file"
  psql "$SUPABASE_DATABASE_URL" -f "$file"
done
```

### الخطوة 4: إنشاء حساب Admin الافتراضي

بعد تطبيق جميع الـ migrations، قم بإنشاء حساب Admin:

```bash
# تأكد من تعيين SUPABASE_DATABASE_URL أولاً
SUPABASE_DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run seed
```

هذا سيُنشئ حساب admin بكود الدخول: `ADMIN2024`

### الخطوة 5: التحقق من نجاح Migrations

في SQL Editor، شغّل الاستعلامات التالية للتحقق:

```sql
-- التحقق من الجداول
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- التحقق من Row Level Security
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- التحقق من الدوال
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;
```

يجب أن ترى:
- ✅ 20+ جدول (requests, drivers, clients, offers, إلخ)
- ✅ Row Security = `true` لجميع الجداول
- ✅ دالة `accept_offer` موجودة

---

## 🌐 الجزء الثاني: نشر API Server على Render

### الخطوة 1: إنشاء حساب على Render

1. افتح [render.com](https://render.com)
2. سجّل الدخول باستخدام حساب GitHub
3. اسمح لـ Render بالوصول إلى repositories

### الخطوة 2: إنشاء Web Service

1. من لوحة التحكم، اضغط **New +**
2. اختر **Web Service**
3. اختر repository `twasalni7/Delivery-Bid-System`
4. إذا لم يظهر، اضغط **Configure Account** وامنح الصلاحيات
5. اضغط **Connect** بجانب الـ repository

### الخطوة 3: إعدادات Web Service

في صفحة إعداد الخدمة:

1. **Name**: `twasalni-api-production`
2. **Region**: اختر الأقرب لك
3. **Branch**: `main` أو `master`
4. **Root Directory**: اتركه فارغاً (جذر المشروع)
5. **Runtime**: `Node`
6. **Build Command**:
   ```bash
   corepack enable && corepack pnpm install && corepack pnpm --filter @workspace/api-server build
   ```
7. **Start Command**:
   ```bash
   node artifacts/api-server/dist/index.mjs
   ```
8. **Instance Type**: اختر `Free` للبداية (يمكن الترقية لاحقاً)

### الخطوة 4: إضافة متغيرات البيئة (Environment Variables)

⚠️ **هذا الجزء مهم جداً!**

اضغط على **Environment** ثم أضف المتغيرات التالية واحداً تلو الآخر:

#### 1. قاعدة البيانات (إلزامي) ✅
```
SUPABASE_DATABASE_URL
```
القيمة: الرابط الذي حصلت عليه من Supabase (Transaction Pooler - منفذ 6543)
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

#### 2. سر الجلسة (إلزامي) ✅
```
SESSION_SECRET
```
القيمة: سلسلة عشوائية طويلة (32 حرف على الأقل)
يمكنك توليدها بالأمر:
```bash
openssl rand -hex 32
```
أو استخدم أي مولد عشوائي آمن

#### 3. بيئة الإنتاج (إلزامي) ✅
```
NODE_ENV
```
القيمة:
```
production
```

#### 4. مفتاح OpenRouteService (موصى به لحساب المسافة بدقة) ✅
```
OPENROUTESERVICE_API_KEY
```
القيمة: مفتاح API من OpenRouteService

**كيفية الحصول على المفتاح:**
1. اذهب إلى [openrouteservice.org](https://openrouteservice.org)
2. اضغط **Sign Up** وأنشئ حساب مجاني
3. اذهب إلى **Dashboard** → **Tokens**
4. اضغط **Request a token**
5. اختر: **Free** plan (يعطيك 2000 طلب يومياً مجاناً)
6. انسخ الـ API Key والصقه في Render

⚠️ **بدون هذا المفتاح، النظام سيستخدم تقدير مسافة خط مستقيم (أقل دقة) وقد لا تظهر المسارات (Polyline).**

#### 5. منفذ الخادم (اختياري)
```
PORT
```
القيمة: `10000` (Render يُعيّنه تلقائياً)

#### 6. OneSignal للإشعارات (اختياري)
```
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY
```
القيمة: من لوحة تحكم OneSignal (إذا كنت تريد استخدام الإشعارات)

#### 7. Sentry للمراقبة (اختياري)
```
VITE_SENTRY_DSN
```
القيمة: من مشروع Sentry الخاص بك

### الخطوة 5: النشر

1. راجع جميع الإعدادات
2. تأكد من إضافة جميع المتغيرات الإلزامية ✅
3. اضغط **Create Web Service**
4. انتظر حتى يكتمل البناء (5-10 دقائق)
5. ستحصل على رابط مثل: `https://twasalni-api-production.onrender.com`

### الخطوة 6: التحقق من نجاح النشر

افتح المتصفح واذهب إلى:
```
https://twasalni-api-production.onrender.com/api/healthz
```

يجب أن ترى رسالة:
```json
{"status":"ok"}
```

إذا رأيت خطأ، تحقق من:
1. **Logs** في Render Dashboard
2. تأكد من `SUPABASE_DATABASE_URL` صحيح
3. تأكد من `SESSION_SECRET` موجود
4. تأكد من `NODE_ENV=production`

---

## 🎨 الجزء الثالث: نشر Frontend على Vercel (اختياري)

يمكنك نشر Frontend على Vercel بدلاً من Render.

### الخطوة 1: إنشاء حساب Vercel

1. افتح [vercel.com](https://vercel.com)
2. سجّل الدخول بحساب GitHub

### الخطوة 2: استيراد المشروع

1. اضغط **Add New** → **Project**
2. اختر `twasalni7/Delivery-Bid-System`
3. اضغط **Import**

### الخطوة 3: الإعدادات

1. **Root Directory**: اتركه على جذر المشروع (لا تغيّره!)
2. **Framework Preset**: Vite
3. **Build Command**: سيُكتشف تلقائياً من `vercel.json`
4. **Output Directory**: سيُكتشف تلقائياً

### الخطوة 4: متغيرات البيئة

أضف نفس المتغيرات السابقة + متغيرات إضافية للـ Frontend:

```
VITE_API_URL
```
القيمة: رابط API Server على Render
```
https://twasalni-api-production.onrender.com
```

```
VITE_ONESIGNAL_APP_ID
```
القيمة: OneSignal App ID (نفسه من Backend)

### الخطوة 5: النشر

1. اضغط **Deploy**
2. انتظر (3-5 دقائق)
3. ستحصل على رابط مثل: `https://twasalni-production.vercel.app`

---

## ✅ قائمة التحقق النهائية قبل الإطلاق

### قاعدة البيانات ✅
- [ ] تم تطبيق جميع الـ 36 migration على Supabase
- [ ] تم إنشاء حساب Admin الافتراضي (`ADMIN2024`)
- [ ] تم التحقق من Row Level Security على جميع الجداول
- [ ] تم تفعيل Automated Backups في Supabase

### Backend (Render) ✅
- [ ] `SUPABASE_DATABASE_URL` صحيح ويستخدم Transaction Pooler (منفذ 6543)
- [ ] `SESSION_SECRET` موجود وطويل وعشوائي
- [ ] `NODE_ENV=production` معين
- [ ] `OPENROUTESERVICE_API_KEY` موجود ومفعّل
- [ ] `/api/healthz` يعطي استجابة `{"status":"ok"}`
- [ ] `/api/readyz` يعطي استجابة `{"ready":true}`

### Frontend (Vercel) - اختياري ✅
- [ ] `VITE_API_URL` يشير إلى Backend على Render
- [ ] الموقع يفتح بدون أخطاء
- [ ] يمكن تسجيل الدخول كـ Admin
- [ ] يمكن إنشاء طلب جديد

### الاختبارات الوظيفية ✅
- [ ] تسجيل دخول Admin يعمل
- [ ] إنشاء طلب جديد من العميل يعمل
- [ ] **حساب المسافة يعمل** (يظهر السعر التلقائي)
- [ ] **التسعير التلقائي يعمل** (السعر الشهري صحيح)
- [ ] السائق يمكنه تقديم عرض
- [ ] العميل يمكنه قبول عرض
- [ ] الإشعارات تعمل (اختياري)

---

## 🔍 استكشاف الأخطاء الشائعة

### ❌ "openrouteservice_not_configured"

**السبب:** مفتاح `OPENROUTESERVICE_API_KEY` غير موجود أو خاطئ

**الحل:**
1. تحقق من وجود المتغير في Render Dashboard
2. تأكد من صحة المفتاح على [openrouteservice.org](https://openrouteservice.org)
3. أعد تشغيل الخدمة بعد إضافة المتغير

### ❌ "Connection refused" أو "Database error"

**السبب:** `SUPABASE_DATABASE_URL` خاطئ

**الحل:**
1. تحقق من استخدام **Transaction Pooler** (منفذ 6543 وليس 5432)
2. تأكد من استبدال `[YOUR-PASSWORD]` بكلمة المرور الفعلية
3. تأكد من عدم وجود مسافات زائدة في الرابط

### ❌ "Session secret is required in production"

**السبب:** `SESSION_SECRET` غير موجود

**الحل:**
1. أضف المتغير في Render Dashboard
2. استخدم `openssl rand -hex 32` لتوليد سر آمن
3. أعد تشغيل الخدمة

### ❌ التسعير التلقائي لا يظهر

**السبب:**
- `OPENROUTESERVICE_API_KEY` غير موجود
- أو API Key غير صالح
- أو تجاوزت حد الطلبات اليومي

**الحل:**
1. تحقق من Logs في Render
2. ابحث عن أخطاء تتعلق بـ "openrouteservice"
3. تحقق من حالة API Key على openrouteservice.org
4. إذا تجاوزت الحد، انتظر 24 ساعة أو ترقية الخطة

---

## 📊 المراقبة والصيانة

### تفعيل Automated Backups (Supabase)

1. في Supabase Dashboard → **Settings** → **Database**
2. ابحث عن **Backups**
3. فعّل **Point-in-time Recovery (PITR)** إذا كان متاحاً
4. أو استخدم `pg_dump` يومياً:
```bash
pg_dump "$SUPABASE_DATABASE_URL" | gzip > backup_$(date +%Y%m%d).sql.gz
```

### مراقبة Logs (Render)

1. في Render Dashboard → اختر Service
2. اضغط **Logs**
3. راقب الأخطاء بانتظام
4. فعّل Email Notifications عند فشل Deploy

### تحديث الكود

عند push إلى `main` branch:
- Render سيُعيد النشر تلقائياً (Auto-Deploy)
- تأكد من اختبار التغييرات محلياً أولاً
- راجع Logs بعد كل deployment

---

## 🎯 الخلاصة

بعد إكمال جميع الخطوات أعلاه:

✅ قاعدة البيانات جاهزة مع 36 migration
✅ Backend يعمل على Render
✅ Frontend يعمل على Vercel (اختياري)
✅ حساب المسافة والتسعير التلقائي يعملان
✅ جميع البوابات (العملاء، السائقين، الأدمن) تعمل
✅ المشروع جاهز للإطلاق! 🎉

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. راجع قسم "استكشاف الأخطاء" أعلاه
2. تحقق من Logs في Render Dashboard
3. تحقق من SQL في Supabase Dashboard
4. تأكد من جميع المتغيرات موجودة وصحيحة

**مفاتيح البيئة الإلزامية للتشغيل:**
- `SUPABASE_DATABASE_URL` ✅
- `SESSION_SECRET` ✅
- `NODE_ENV=production` ✅
- `OPENROUTESERVICE_API_KEY` (موصى به لحساب مسافة الطرق بدقة)

بدون المفاتيح الثلاثة الأولى، النظام **لن يعمل**. وبدون `OPENROUTESERVICE_API_KEY` ستعمل المنظومة بتقدير مسافة تقريبي.
