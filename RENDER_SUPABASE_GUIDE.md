# 📚 دليل Render + Supabase الشامل

> لك اللي تشتغل على Render و Supabase

---

## 🎯 الهدف

نشر التطبيق على **Render** للـ API و **Vercel/Render** للـ Frontend، مع ربط قاعدة بيانات **Supabase** PostgreSQL.

---

## 🔧 الإعداد الأولي

### 1. إنشاء حساب Supabase

1. اذهب إلى https://supabase.com
2. اضغط "Start your project"
3. سجل بـ GitHub
4. اختر Organization (أو انشئ واحدة جديدة)
5. ملأ البيانات:
   - **Project Name:** `delivery-bid-system`
   - **Database Password:** (احفظها في مكان آمن)
   - **Region:** `Europe` أو الأقرب إليك

### 2. احصل على Connection String

بعد ما ينشئ المشروع:

1. اذهب إلى **Settings** → **Database**
2. ابحث عن **Connection String**
3. اختر **Transaction Pooler** (مهم!)
4. المنفذ يجب يكون **6543** (مش 5432)
5. احسب الرابط بهذا الشكل:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres
```

مثال:
```
postgresql://postgres:MyPassword123@db.abc123def.supabase.co:6543/postgres
```

---

## 🏗️ الخطوة الأولى: إعداد قاعدة البيانات

### 1. شغّل الـ Migration محليًا

```bash
# ركب .env محليًا
export SUPABASE_DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres"

# شغّل التحديثات (migrations)
pnpm --filter @workspace/db run push

# يجب تشوف: ✓ Schema pushed successfully
```

### 2. طبّق Row Level Security

```bash
SUPABASE_DATABASE_URL="..." node scripts/apply-rls.mjs

# يجب تشوف: ✓ RLS policies applied
```

### 3. ضيف بيانات اختبار

```bash
SUPABASE_DATABASE_URL="..." pnpm --filter @workspace/db run seed

# يجب تشوف: Admin user created with login code ADMIN2024
```

---

## 🚀 الخطوة الثانية: نشر على Render

### 1. انشئ حساب Render

1. اذهب إلى https://render.com
2. سجل بـ GitHub
3. اربط حسابك بـ GitHub

### 2. اربط الـ Repository

1. اذهب إلى **Dashboard**
2. اضغط **New +** → **Web Service**
3. اختر `twasalni7/Delivery-Bid-System`
4. ملأ البيانات:
   - **Name:** `delivery-bid-api`
   - **Runtime:** `Node`
   - **Build Command:** ترك الافتراضي (سيقرأ `render.yaml`)
   - **Start Command:** ترك الافتراضي

### 3. أضف متغيرات البيئة

اذهب إلى **Environment**:

```
NODE_ENV                 = production
DATABASE_URL             = postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres
SESSION_SECRET           = (Generate a random string: openssl rand -hex 32)
APP_URL                  = https://delivery-bid-api.render.com
OPENROUTESERVICE_API_KEY = (optional - للـ routing)
```

### 4. ابدأ النشر

1. اضغط **Create Web Service**
2. انتظر حتى ينتهي البناء (قد يأخذ 3-5 دقائق)
3. اذهب إلى Logs وشوف النتائج

### 5. تحقق من صحة النشر

```bash
# جرّب health check
curl https://delivery-bid-api.render.com/api/healthz

# يجب تشوف:
# {"status":"ok","uptime":123.456}
```

---

## 🎨 الخطوة الثالثة: نشر الـ Frontend

اخترت **Vercel** (الأسهل):

### 1. اذهب إلى Vercel

https://vercel.com

### 2. Import Repository

1. اضغط **Add New** → **Project**
2. اختر `twasalni7/Delivery-Bid-System`
3. ملأ البيانات:
   - **Framework Preset:** Other (لأنه monorepo)
   - **Root Directory:** `.` (جذر المشروع)
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `artifacts/delivery-bidding/dist/public`

### 3. أضف متغيرات البيئة

```
VITE_API_URL = https://delivery-bid-api.render.com
```

### 4. ابدأ النشر

1. اضغط **Deploy**
2. انتظر حتى ينتهي (قد يأخذ 5-10 دقائق)

---

## 🔗 ربط الـ Frontend بـ API

بعد النشر، اذهب إلى:

**Frontend** → **Settings** → **Environment Variables**

أضف:
```
VITE_API_URL = https://delivery-bid-api.render.com
```

ثم:
1. اذهب إلى **Deployments**
2. اضغط الـ Latest Deployment
3. اضغط **Redeploy**

---

## 🐛 المشاكل الشائعة والحلول

### ❌ "Connection refused" في Render Logs

**السبب:** Database URL خاطئة

**الحل:**
```bash
# تحقق أن القيمة صحيحة
echo $SUPABASE_DATABASE_URL

# أعد تعيينها في Render Dashboard
```

### ❌ "SSL certificate problem"

**السبب:** Supabase يطلب SSL connection

**الحل:** أضف `?sslmode=require` لـ DATABASE_URL:

```
postgresql://postgres:...@db.supabase.co:6543/postgres?sslmode=require
```

### ❌ "503 Service Unavailable"

**السبب:** قاعدة البيانات معطلة أو مشغولة جداً

**الحل:**
```bash
# تحقق من صحة الاتصال محليًا
psql $SUPABASE_DATABASE_URL

# إذا لم ينجح، اعد تشغيل قاعدة البيانات من Supabase Dashboard
```

### ❌ "Unexpected end of JSON input"

**السبب:** الـ API ترجع استجابة ناقصة

**الحل:**
1. افتح Render Logs
2. ابحث عن الـ error
3. أعد نشر التطبيق:
   ```bash
   # في Render Dashboard
   Manual Deploy → Deploy latest commit
   ```

---

## 📊 مراقبة الـ Production

### في Render Dashboard

1. اذهب إلى **Logs**
2. اختر **Runtime Log**
3. ابحث عن `ERROR` أو `500`

### في Supabase Dashboard

1. اذهب إلى **Logs** → **Database Logs**
2. شوف إذا فيه slow queries أو errors

### في Vercel Dashboard

1. اذهب إلى **Analytics**
2. شوف عدد الـ requests و الـ errors

---

## 🔐 الأمان

### 1. امسح .env الحساسة

```bash
# تأكد من أن هذه الملفات في .gitignore
.env
.env.local
.env.production
```

### 2. دوّر المفاتيح الحساسة

إذا كان أي شخص شاف `SESSION_SECRET`:
1. اذهب إلى Render Dashboard
2. غيّر `SESSION_SECRET` إلى قيمة جديدة
3. أعد نشر التطبيق

### 3. استخدم IP Whitelist (اختياري)

في Supabase:
1. اذهب إلى **Database** → **Connection Info**
2. ابحث عن **Firewall** أو **IP Whitelist**
3. أضف IP الـ Render Server

---

## ✅ Checklist النشر

بعد الانتهاء من كل شيء:

- [ ] Supabase project تم إنشاؤه
- [ ] DATABASE_URL تم الحصول عليها
- [ ] Migrations تم تطبيقها
- [ ] RLS Policies تم تطبيقها
- [ ] Seed data تم إضافتها
- [ ] Render Web Service تم نشره
- [ ] Frontend تم نشره على Vercel
- [ ] Health check يعمل (`/api/healthz` يعود 200)
- [ ] يمكن تسجيل الدخول برمز ADMIN2024
- [ ] يمكن إنشاء طلب جديد بدون أخطاء

---

## 📞 الدعم

إذا واجهت مشكلة:

1. **اقرأ Logs** على Render و Supabase
2. **جرّب محليًا** قبل النشر
3. **تحقق من Environment Variables** أنها صحيحة
4. **أعد نشر** التطبيق

---

**التاريخ:** 2 يونيو 2026
**النسخة:** 1.0
