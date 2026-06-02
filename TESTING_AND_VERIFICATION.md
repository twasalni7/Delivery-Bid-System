# 🧪 دليل الاختبار والتحقق من الإصلاح

> تأكد من أن كل شيء يعمل بشكل صحيح

---

## المرحلة الأولى: الاختبار المحلي

### 1️⃣ تحقق من التثبيت

```bash
# تأكد من Node و pnpm
node --version        # يجب 22.x
pnpm --version        # يجب 10.x

# ركب المشروع
pnpm install

# بناء المشروع
pnpm run build
```

### 2️⃣ اختبر الخادم محليًا

```bash
# شغّل الخادم
pnpm --filter @workspace/api-server run dev

# في terminal آخر، جرّب health check
curl http://localhost:3000/api/healthz

# يجب تشوف:
# {"status":"ok","uptime":0.123}
```

### 3️⃣ اختبر الـ Frontend

```bash
# شغّل الـ frontend
pnpm --filter @workspace/delivery-bidding run dev

# افتح http://localhost:5173 في المتصفح
```

### 4️⃣ اختبر API Call

افتح DevTools (F12) وشغّل:

```javascript
// في console
fetch('/api/healthz')
  .then(r => r.json())
  .then(d => console.log('✅ Success:', d))
  .catch(e => console.error('❌ Error:', e))
```

يجب تشوف: `✅ Success: {status: "ok", ...}`

---

## المرحلة الثانية: الاختبار مع قاعدة البيانات

### 1️⃣ اعداد Supabase محليًا

```bash
# اربط DATABASE_URL
export SUPABASE_DATABASE_URL="postgresql://..."

# شغّل الـ migrations
pnpm --filter @workspace/db run push

# يجب تشوف: ✓ Schema pushed successfully
```

### 2️⃣ اختبر الاتصال مباشرة

```bash
# في terminal
psql $SUPABASE_DATABASE_URL -c "SELECT 1"

# يجب تشوف: (1 row)
```

### 3️⃣ اختبر API request

```bash
# جرّب GET requests (بدون authentication للـ health check)
curl http://localhost:3000/api/healthz

# جرّب مع authorization header
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/requests
```

---

## المرحلة الثالثة: اختبر الخطأ الأساسي

### 1️⃣ تأكد أن الخطأ اختفى

افتح المتصفح وجرّب:

```javascript
// في DevTools console
async function testAPI() {
  const response = await fetch('/api/requests', {
    headers: {'Authorization': 'Bearer YOUR_TOKEN'}
  });
  
  const data = await response.json();
  console.log('✅ Response OK:', data);
}

testAPI().catch(e => console.error('❌ Error:', e));
```

### 2️⃣ شوف الـ logs

في terminal الخادم، يجب تشوف:

```
[API] GET /api/requests - 200 OK
[safeFetch] Request successful
```

لا يجب تشوف:

```
❌ Unexpected end of JSON input
❌ JSON.stringify failed
```

---

## المرحلة الرابعة: اختبر عملية إنشاء الطلب

### 1️⃣ سجّل دخول

```bash
# من الـ frontend أو الـ mobile app
curl -X POST http://localhost:3000/api/auth/login-client \
  -H "Content-Type: application/json" \
  -d '{"loginCode":"USER123"}'

# احفظ الـ token من الـ response
```

### 2️⃣ ادخل الـ token

```bash
export TOKEN="your_token_here"
```

### 3️⃣ انشئ طلب جديد

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "homeLocation": "الرياض",
    "workLocation": "جدة",
    "morningTime": "07:00",
    "numberOfPeople": 1,
    "workingDaysPerWeek": 5,
    "numberOfShifts": 1
  }'

# يجب تشوف:
# {
#   "id": 1,
#   "homeLocation": "الرياض",
#   "status": "OPEN",
#   ...
# }
```

### 4️⃣ اختبر في المتصفح

1. افتح http://localhost:5173
2. سجّل دخول
3. ادخل موقع البيت والعمل
4. اضغط "إنشاء طلب"
5. شوف في DevTools → Network:
   - Request status يجب 201
   - Response يجب JSON صحيح (ينتهي بـ `}`)

---

## المرحلة الخامسة: اختبر على Render + Supabase

### ✅ بعد النشر على Render

#### 1. اختبر Health Check

```bash
curl https://delivery-bid-api.render.com/api/healthz

# يجب تشوف:
# {"status":"ok"}
```

#### 2. اختبر Database Connection

في Render Dashboard → Logs، يجب تشوف:

```
✅ [INFO] Database connected successfully
✅ [INFO] Server listening on port 3000
```

لا يجب تشوف:

```
❌ Connection refused
❌ ECONNREFUSED
❌ Database is unavailable
```

#### 3. اختبر من الـ Frontend

افتح https://your-frontend-url.vercel.app

سجّل دخول وجرّب إنشاء طلب

#### 4. شوف الـ Logs

```
Render Logs:
✅ POST /api/requests 201 OK
✅ Request created successfully

Supabase Logs:
✅ INSERT INTO requests ...
```

---

## 🔍 Debugging Checklist

إذا كان في مشاكل، تحقق من:

### Frontend Debugging

- [ ] DevTools Console: لا توجد red errors
- [ ] Network Tab: جميع requests 2xx أو 4xx (مش 5xx)
- [ ] Response: JSON صحيح (يبدأ بـ `{` وينتهي بـ `}`)

### Backend Debugging

- [ ] `npm logs`: لا توجد `error` أو `500`
- [ ] `console.log`: تظهر رسائل التتبع
- [ ] Database: `psql` يتصل بنجاح

### Database Debugging

```sql
-- في Supabase SQL Editor
SELECT COUNT(*) FROM requests;
SELECT * FROM requests LIMIT 1;
```

---

## ✅ علامات النجاح النهائية

بعد كل شيء، يجب:

- ✅ `safeFetch` تعيد response صحيحة
- ✅ لا توجد `Unexpected end of JSON input` errors
- ✅ API requests تنجح بـ 2xx status codes
- ✅ الطلبات تُنشأ بنجاح في قاعدة البيانات
- ✅ الـ logs نظيفة من الأخطاء
- ✅ Frontend يعرض البيانات بدون مشاكل
- ✅ Render و Supabase متصلة بشكل صحيح

---

## 📞 إذا استمرت المشاكل

1. **اقرأ الـ stack trace كاملاً** - ابحث عن السطر الأول من الخطأ
2. **اختبر محليًا أولاً** - قبل النشر على Render
3. **تحقق من Environment Variables** - ابحث عن typos
4. **أعد نشر المشروع** - قد يحل بعض المشاكل
5. **امسح الـ cache** - في المتصفح والخادم

---

**تاريخ الآخر تحديث:** 2 يونيو 2026
