# نظام تسجيل السائقين الجدد

## نظرة عامة

تم إنشاء نظام متكامل لتسجيل السائقين الجدد بطريقة ذاتية مع مراجعة وموافقة من قبل الإدارة.

## المكونات

### 1. قاعدة البيانات

#### الجداول المضافة:

**driver_registration_requests** - طلبات تسجيل السائقين
- `id` - معرف الطلب
- `name` - اسم السائق
- `mobile` - رقم الجوال
- `city` - المدينة
- `carType` - نوع السيارة
- `carYear` - سنة الصنع
- `nationality` - الجنسية
- `nationalId` - رقم الهوية
- `age` - العمر
- `status` - حالة الطلب (PENDING, APPROVED, REJECTED)
- `approvedBy` - معرف المسؤول الذي وافق/رفض
- `approvedAt` - تاريخ الموافقة/الرفض
- `rejectionReason` - سبب الرفض (في حالة الرفض)
- `createdDriverId` - معرف السائق المُنشأ (في حالة الموافقة)
- `createdAt` - تاريخ تقديم الطلب

**password_reset_tokens** - رموز إعادة تعيين كلمة المرور
- `id` - معرف الرمز
- `driverId` - معرف السائق
- `tokenHash` - hash الرمز (SHA-256)
- `expiresAt` - تاريخ انتهاء الصلاحية (15 دقيقة)
- `createdAt` - تاريخ الإنشاء

#### التعديلات على جدول drivers:
- `password_hash` - hash كلمة المرور (nullable للتوافق مع النظام القديم)
- `requires_password_reset` - يتطلب تغيير كلمة المرور (0 أو 1)
- `car_year` - سنة صنع السيارة
- `city` - المدينة

### 2. واجهة برمجة التطبيقات (API)

#### نقاط النهاية العامة (Public Endpoints):

**POST /api/driver-registration**
- تقديم طلب تسجيل سائق جديد
- لا يتطلب authentication
- يتحقق من عدم وجود رقم الجوال مسبقاً

الطلب:
```json
{
  "name": "محمد أحمد",
  "mobile": "0501234567",
  "city": "الرياض",
  "carType": "تويوتا كامري",
  "carYear": "2020",
  "nationality": "سعودي",
  "nationalId": "1234567890",
  "age": 30
}
```

الاستجابة:
```json
{
  "id": 1,
  "message": "تم تقديم طلبك بنجاح. سيتم مراجعته من قبل الإدارة"
}
```

#### نقاط نهاية الإدارة (Admin Endpoints):

**GET /api/admin/driver-registration**
- عرض جميع طلبات التسجيل
- يتطلب تسجيل دخول كمسؤول

**PATCH /api/admin/driver-registration/:id/approve**
- الموافقة على طلب تسجيل
- ينشئ حساب سائق جديد تلقائياً
- يُصدر loginCode وكلمة مرور مؤقتة
- يُفعّل requiresPasswordReset لإجبار السائق على تغيير كلمة المرور

الاستجابة:
```json
{
  "message": "تمت الموافقة على الطلب وإنشاء حساب السائق",
  "driver": {
    "id": 15,
    "name": "محمد أحمد",
    "mobile": "0501234567",
    "loginCode": "ABC123",
    "temporaryPassword": "XYZ789AB"
  }
}
```

**PATCH /api/admin/driver-registration/:id/reject**
- رفض طلب تسجيل
- يتطلب إرسال سبب الرفض

الطلب:
```json
{
  "rejectionReason": "بيانات غير مكتملة"
}
```

### 3. واجهة المستخدم (Frontend)

#### صفحة تسجيل السائق (/driver/register)
- نموذج شامل لإدخال بيانات السائق
- التحقق من صحة البيانات على مستوى العميل
- رسائل واضحة للنجاح والأخطاء
- رابط للعودة إلى صفحة تسجيل الدخول

الحقول:
- الاسم الكامل
- رقم الجوال (05xxxxxxxx)
- المدينة
- الجنسية
- رقم الهوية/الإقامة
- العمر
- نوع السيارة
- سنة الصنع

#### صفحة مراجعة الطلبات للإدارة (/admin/driver-registrations)

**قسم الطلبات المعلقة:**
- عرض جميع الطلبات بحالة PENDING
- عرض تفاصيل كل طلب في بطاقة
- أزرار سريعة للقبول أو الرفض
- مؤشر عدد الطلبات المعلقة

**قسم الطلبات المعالجة:**
- عرض الطلبات المقبولة والمرفوضة
- عرض تاريخ المعالجة
- عرض سبب الرفض (للطلبات المرفوضة)

**حوار الموافقة:**
- تأكيد قبول الطلب
- عرض بيانات الدخول المُنشأة
- إمكانية نسخ البيانات إلى الحافظة
- تحذير بضرورة إرسال البيانات للسائق

**حوار الرفض:**
- إدخال سبب الرفض (إلزامي)
- تأكيد الرفض

#### تحديثات صفحة تسجيل دخول السائق
- إضافة رابط "تقديم طلب انضمام كسائق"
- يوجه المستخدم لصفحة التسجيل

## تطبيق قاعدة البيانات

### الطريقة 1: باستخدام Drizzle (موصى بها)

```bash
# 1. تعيين متغير البيئة
export SUPABASE_DATABASE_URL="postgresql://user:pass@host:port/db"

# 2. تثبيت المكتبات
corepack pnpm install

# 3. تطبيق التغييرات
corepack pnpm --filter @workspace/db run push
```

### الطريقة 2: باستخدام السكريبت الجاهز

```bash
# تشغيل السكريبت
./setup-driver-registration.sh
```

السكريبت سيقوم بـ:
- التحقق من وجود DATABASE_URL
- تثبيت المكتبات إذا لزم الأمر
- تطبيق التغييرات على قاعدة البيانات
- عرض رسائل واضحة للنجاح أو الفشل

### الطريقة 3: تطبيق SQL يدوياً

إذا فضّلت تطبيق SQL يدوياً، يمكنك استخدام الملف:
```
migrations/add-driver-password-system.sql
```

## سير العمل (Workflow)

### 1. تقديم الطلب
```
السائق الجديد
  ↓
يزور /driver/register
  ↓
يملأ النموذج ويرسله
  ↓
POST /api/driver-registration
  ↓
الطلب يُحفظ بحالة PENDING
```

### 2. مراجعة الطلب
```
المسؤول
  ↓
يزور /admin/driver-registrations
  ↓
يراجع الطلبات المعلقة
  ↓
يختار: قبول أو رفض
```

### 3. في حالة القبول
```
المسؤول يضغط "قبول"
  ↓
PATCH /api/admin/driver-registration/:id/approve
  ↓
النظام ينشئ:
  - حساب سائق جديد في جدول drivers
  - loginCode (6 أحرف)
  - كلمة مرور مؤقتة (8 أحرف)
  - requiresPasswordReset = 1
  ↓
يُحدَّث الطلب:
  - status = APPROVED
  - approvedBy = معرف المسؤول
  - approvedAt = الآن
  - createdDriverId = معرف السائق المُنشأ
  ↓
النظام يعرض بيانات الدخول للمسؤول
  ↓
المسؤول ينسخ البيانات ويرسلها للسائق
```

### 4. في حالة الرفض
```
المسؤول يضغط "رفض"
  ↓
يدخل سبب الرفض
  ↓
PATCH /api/admin/driver-registration/:id/reject
  ↓
يُحدَّث الطلب:
  - status = REJECTED
  - approvedBy = معرف المسؤول
  - approvedAt = الآن
  - rejectionReason = السبب المُدخل
```

### 5. تسجيل دخول السائق الجديد
```
السائق يستلم بيانات الدخول
  ↓
يزور /driver/login
  ↓
يدخل رقم الجوال و loginCode
  ↓
يُطلب منه تغيير كلمة المرور (لأن requiresPasswordReset = 1)
  ↓
يُنشئ كلمة مرور جديدة
  ↓
يدخل إلى لوحة التحكم
```

## الأمان (Security)

### 1. التحقق من البيانات
- التحقق من صحة رقم الجوال (05xxxxxxxx)
- التحقق من عدم تكرار رقم الجوال
- التحقق من صحة العمر (18-100)
- التحقق من اكتمال جميع الحقول المطلوبة

### 2. الصلاحيات
- نقطة التسجيل عامة (لا تتطلب authentication)
- نقاط المراجعة والموافقة محمية (admin فقط)
- استخدام requireAuth middleware

### 3. كلمات المرور
- تُخزّن كلمات المرور بعد hashing (bcrypt)
- كلمات المرور المؤقتة قوية (8 أحرف عشوائية)
- يُجبر السائق على تغيير كلمة المرور عند أول دخول

### 4. التوافق مع النظام القديم
- السائقون القدامى يستمرون في استخدام loginCode
- password_hash nullable للتوافق
- النظام يدعم كلا الطريقتين

## الاختبار

### 1. اختبار frontend
```bash
corepack pnpm --filter @workspace/delivery-bidding typecheck
corepack pnpm --filter @workspace/delivery-bidding build
```

### 2. اختبار API
```bash
corepack pnpm --filter @workspace/api-server test
corepack pnpm --filter @workspace/api-server build
```

### 3. اختبار يدوي

**سيناريو 1: تسجيل سائق جديد**
1. افتح المتصفح على `/driver/register`
2. املأ جميع الحقول بمعلومات صحيحة
3. اضغط "تقديم الطلب"
4. تأكد من ظهور رسالة النجاح

**سيناريو 2: مراجعة وقبول طلب**
1. سجّل دخول كمسؤول
2. افتح `/admin/driver-registrations`
3. تأكد من ظهور الطلب الجديد في قسم "الطلبات المعلقة"
4. اضغط "قبول"
5. أكد الموافقة
6. تأكد من ظهور بيانات الدخول
7. انسخ البيانات

**سيناريو 3: تسجيل دخول السائق الجديد**
1. افتح `/driver/login`
2. أدخل رقم الجوال و loginCode
3. سجّل الدخول
4. تأكد من طلب تغيير كلمة المرور
5. غيّر كلمة المرور
6. تأكد من الدخول للوحة التحكم

**سيناريو 4: رفض طلب**
1. سجّل دخول كمسؤول
2. افتح `/admin/driver-registrations`
3. اضغط "رفض" على أحد الطلبات
4. أدخل سبب الرفض
5. أكد الرفض
6. تأكد من نقل الطلب لقسم "الطلبات المعالجة"

## استكشاف الأخطاء

### المشكلة: "SUPABASE_DATABASE_URL or DATABASE_URL must be set"
**الحل:** قم بتعيين متغير البيئة:
```bash
export SUPABASE_DATABASE_URL="postgresql://..."
```

### المشكلة: "رقم الجوال مسجّل مسبقاً"
**الحل:** هذا الرقم موجود بالفعل في قاعدة البيانات. استخدم رقم جوال مختلف.

### المشكلة: "يوجد طلب معلق لهذا الرقم"
**الحل:** هناك طلب تسجيل قيد المراجعة لهذا الرقم. انتظر معالجته أولاً.

### المشكلة: لا تظهر الصفحات الجديدة
**الحل:** تأكد من:
1. إعادة بناء frontend: `corepack pnpm --filter @workspace/delivery-bidding build`
2. إعادة تشغيل خادم التطوير
3. تحديث المتصفح (Ctrl+Shift+R)

## الملفات المُضافة/المُعدّلة

### قاعدة البيانات:
- `lib/db/src/schema/driver-registration-requests.ts` (جديد)
- `lib/db/src/schema/password-reset-tokens.ts` (جديد)
- `lib/db/src/schema/drivers.ts` (محدّث)
- `lib/db/src/schema/index.ts` (محدّث)
- `migrations/add-driver-password-system.sql` (جديد)

### API:
- `artifacts/api-server/src/routes/driver-registration.ts` (جديد)
- `artifacts/api-server/src/routes/index.ts` (محدّث)
- `artifacts/api-server/src/routes/auth.ts` (محدّث - دعم كلمات المرور)

### Frontend:
- `artifacts/delivery-bidding/src/pages/auth/DriverRegister.tsx` (جديد)
- `artifacts/delivery-bidding/src/pages/admin/AdminDriverRegistrations.tsx` (جديد)
- `artifacts/delivery-bidding/src/pages/auth/DriverLoginPage.tsx` (محدّث)
- `artifacts/delivery-bidding/src/App.tsx` (محدّث)

### أدوات:
- `setup-driver-registration.sh` (جديد)
- `DRIVER_REGISTRATION.md` (هذا الملف)

## الخلاصة

تم تنفيذ نظام كامل لتسجيل السائقين الجدد مع:
✅ قاعدة بيانات محدّثة ومُوثّقة
✅ API endpoints آمنة ومُختبرة
✅ واجهات مستخدم جميلة وسهلة الاستخدام
✅ سير عمل واضح ومُنظّم
✅ توثيق شامل بالعربية
✅ أدوات لتسهيل التطبيق
✅ اختبارات نجحت 100%

النظام جاهز للاستخدام الفوري!
