# اختبار شامل للإشعارات - Notification System Verification Tests

## نظرة عامة
هذا المستند يوضح جميع أحداث الإشعارات في النظام ويوفر خطة اختبار شاملة للتأكد من أن كل حدث يُرسل إشعارات داخلية وخارجية بشكل صحيح.

## البوابات (Gateways)

### 1. الإشعارات الخارجية (External/Push Notifications)
- **OneSignal** (الطريقة الأساسية الحالية)
  - Location: `artifacts/api-server/src/lib/onesignal.ts`
  - Configuration: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
  - User ID Format: `${role}:${id}` (e.g., "driver:42", "client:7")

- **Web Push (Legacy Fallback)**
  - Location: `artifacts/api-server/src/lib/notify.ts` - `sendWebPush()`
  - Configuration: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - يُستخدم فقط عندما OneSignal غير مفعّل

### 2. الإشعارات الداخلية (In-App Notifications)
- **Database Storage**: جميع الإشعارات تُحفظ في `notifications` table
- **Location**: `lib/db/src/schema/notifications.ts`
- **Fields**:
  - userId, userRole, title, message, type, relatedId
  - url, actionType, actionLabel, actionPayload
  - isRead, readAt, deliveredAt, deliveryStatus, provider

---

## أحداث الإشعارات وتغطيتها

### 📦 أحداث الطلبات (Request Events)

#### 1. طلب جديد من عميل
**File**: `artifacts/api-server/src/routes/requests.ts:441`
```typescript
void notifyAllAdmins({
  title: "طلب جديد",
  message: `طلب رقم #${request.id}: ${pickupLocation} → ${dropoffLocation}`,
  type: "request",
  relatedId: request.id,
  url: `/admin/requests/${request.id}`
});
```
**Test**:
- ✅ Create new request as client
- ✅ Verify all admins receive in-app notification
- ✅ Verify all admins receive push notification (OneSignal/Web Push)

#### 2. نشر طلب للسائقين
**File**: `artifacts/api-server/src/routes/requests.ts:450`
```typescript
void notifyAllDrivers({
  title: "طلب جديد متاح",
  message: `طلب توصيل: ${pickupLocation} → ${dropoffLocation}`,
  type: "request",
  relatedId: request.id,
  url: `/driver/requests/${request.id}`
});
```
**Test**:
- ✅ Admin publishes request to drivers
- ✅ Verify all ACTIVE drivers receive in-app notification
- ✅ Verify all ACTIVE drivers receive push notification

#### 3. تحديث حالة الطلب
**File**: `artifacts/api-server/src/routes/requests.ts:699`
```typescript
void notifyAllAdmins({
  title: "تحديث حالة طلب",
  message: `الطلب #${request.id} تم تحديث حالته إلى ${newStatus}`,
  type: "request",
  relatedId: request.id,
  url: `/admin/requests/${request.id}`
});
```
**Test**:
- ✅ Admin updates request status
- ✅ Verify all admins receive notification

#### 4. اختيار سائق للطلب
**File**: `artifacts/api-server/src/routes/requests.ts:842`
```typescript
void notify({
  userId: request.clientId,
  userRole: "client",
  title: "تم اختيار السائق",
  message: `تم اختيار ${driver.name} لطلبك #${request.id}`,
  type: "request",
  relatedId: request.id,
  url: `/client/requests/${request.id}`
});
```
**Test**:
- ✅ Client selects driver for their request
- ✅ Verify client receives in-app notification
- ✅ Verify client receives push notification

#### 5. إشعار السائق بالاختيار
**File**: `artifacts/api-server/src/routes/requests.ts:862`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تم اختيارك لطلب",
  message: `تم اختيارك للطلب #${request.id}`,
  type: "request",
  relatedId: request.id,
  url: `/driver/requests/${request.id}`
});
```
**Test**:
- ✅ When driver is selected
- ✅ Verify driver receives in-app notification
- ✅ Verify driver receives push notification

#### 6. إلغاء الطلب
**File**: `artifacts/api-server/src/routes/requests.ts:1033`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تم إلغاء الطلب",
  message: `الطلب #${requestId} تم إلغاؤه`,
  type: "request",
  relatedId: requestId,
  url: `/driver/requests`
});
```
**Test**:
- ✅ Client or admin cancels request
- ✅ Verify assigned driver receives notification

#### 7. تعديل الطلب
**File**: `artifacts/api-server/src/routes/requests.ts:1060`
```typescript
notify({
  userId: driverId,
  userRole: "driver",
  title: "تم تعديل الطلب",
  message: `الطلب #${requestId} تم تعديله`,
  type: "request",
  relatedId: requestId,
  url: `/driver/requests/${requestId}`
});
```
**Test**:
- ✅ Request details are updated
- ✅ Verify assigned driver receives notification

---

### 💵 أحداث العروض (Offer Events)

#### 8. عرض جديد من سائق
**File**: `artifacts/api-server/src/routes/offers.ts:332`
```typescript
void notify({
  userId: clientId,
  userRole: "client",
  title: "عرض جديد",
  message: `السائق ${driver.name} قدم عرضاً على طلبك`,
  type: "offer",
  relatedId: request.id,
  url: `/client/requests/${request.id}`
});
```
**Test**:
- ✅ Driver submits offer
- ✅ Verify client receives in-app notification
- ✅ Verify client receives push notification

#### 9. عرض جديد - إشعار الإدارة
**File**: `artifacts/api-server/src/routes/offers.ts:344`
```typescript
void notifyAllAdmins({
  title: "عرض جديد",
  message: `عرض جديد على الطلب #${requestId}`,
  type: "offer",
  relatedId: requestId,
  url: `/admin/requests/${requestId}`
});
```
**Test**:
- ✅ Driver submits offer
- ✅ Verify all admins receive notification

---

### 💬 أحداث الرسائل (Message Events)

#### 10. رسالة جديدة للسائق
**File**: `artifacts/api-server/src/routes/messages.ts:134`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "رسالة جديدة",
  message: truncatedBody,
  type: "request",
  relatedId: requestId,
  url: `/driver/requests/${requestId}`
});
```
**Test**:
- ✅ Client sends message to driver
- ✅ Verify driver receives notification

#### 11. رسالة جديدة للعميل
**File**: `artifacts/api-server/src/routes/messages.ts:144`
```typescript
void notify({
  userId: clientId,
  userRole: "client",
  title: "رسالة جديدة",
  message: truncatedBody,
  type: "request",
  relatedId: requestId,
  url: `/client/requests/${requestId}`
});
```
**Test**:
- ✅ Driver sends message to client
- ✅ Verify client receives notification

---

### 🎫 أحداث الدعم (Support Events)

#### 12. تذكرة دعم جديدة
**File**: `artifacts/api-server/src/routes/support-tickets.ts:71`
```typescript
void notifyAllAdmins({
  title: "تذكرة دعم جديدة",
  message: `تذكرة #${insertedId}: ${subject}`,
  type: "support",
  relatedId: insertedId,
  url: `/admin/support/${insertedId}`
});
```
**Test**:
- ✅ User creates support ticket
- ✅ Verify all admins receive notification

#### 13. رد إداري على تذكرة
**File**: `artifacts/api-server/src/routes/support-tickets.ts:197`
```typescript
void notify({
  userId,
  userRole,
  title: "رد على تذكرتك",
  message: `رد جديد على التذكرة #${ticketId}`,
  type: "support",
  relatedId: ticketId,
  url: `/${userRole}/support/${ticketId}`
});
```
**Test**:
- ✅ Admin replies to ticket
- ✅ Verify ticket owner receives notification

#### 14. رد من صاحب التذكرة
**File**: `artifacts/api-server/src/routes/support-tickets.ts:207`
```typescript
void notify({
  userId: adminId,
  userRole: "admin",
  title: "رد جديد على تذكرة",
  message: `رد جديد على التذكرة #${ticketId}`,
  type: "support",
  relatedId: ticketId,
  url: `/admin/support/${ticketId}`
});
```
**Test**:
- ✅ User replies to their ticket
- ✅ Verify assigned admin receives notification

---

### 💳 أحداث المحفظة (Wallet Events)

#### 15. طلب سحب أموال جديد
**File**: `artifacts/api-server/src/routes/wallet-transactions.ts:121`
```typescript
void notifyAllAdmins({
  title: "طلب سحب جديد",
  message: `طلب سحب ${amount} ريال من ${driverName}`,
  type: "system",
  url: `/admin/drivers?tab=withdrawals`
});
```
**Test**:
- ✅ Driver requests withdrawal
- ✅ Verify all admins receive notification

#### 16. اعتماد السحب
**File**: `artifacts/api-server/src/routes/wallet-transactions.ts:229`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تمت الموافقة على طلب السحب",
  message: `تمت الموافقة على سحب ${amount} ريال`,
  type: "system",
  url: `/driver/wallet`
});
```
**Test**:
- ✅ Admin approves withdrawal
- ✅ Verify driver receives notification

#### 17. رفض السحب
**File**: `artifacts/api-server/src/routes/wallet-transactions.ts:288`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تم رفض طلب السحب",
  message: `تم رفض سحب ${amount} ريال. السبب: ${reason}`,
  type: "system",
  url: `/driver/wallet`
});
```
**Test**:
- ✅ Admin rejects withdrawal
- ✅ Verify driver receives notification

---

### 🏦 أحداث الحسابات البنكية (Bank Account Events)

#### 18. حساب بنكي جديد
**File**: `artifacts/api-server/src/routes/bank-accounts.ts:90`
```typescript
void notifyAllAdmins({
  title: "حساب بنكي جديد",
  message: `السائق ${driverName} أضاف حساباً بنكياً`,
  type: "system",
  url: `/admin/drivers`
});
```
**Test**:
- ✅ Driver adds bank account
- ✅ Verify all admins receive notification

#### 19. تحديث حساب بنكي
**File**: `artifacts/api-server/src/routes/bank-accounts.ts:196`
```typescript
void notifyAllAdmins({
  title: "تحديث حساب بنكي",
  message: `السائق ${driverName} حدّث الحساب البنكي`,
  type: "system",
  url: `/admin/drivers`
});
```
**Test**:
- ✅ Driver updates bank account
- ✅ Verify all admins receive notification

---

### 👤 أحداث إدارية (Admin Actions)

#### 20. تفعيل سائق
**File**: `artifacts/api-server/src/routes/admin.ts:908`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تم تفعيل حسابك",
  message: "تم تفعيل حسابك بنجاح",
  type: "system",
  url: `/driver/dashboard`
});
```
**Test**:
- ✅ Admin activates driver
- ✅ Verify driver receives notification

#### 21. حظر سائق
**File**: `artifacts/api-server/src/routes/admin.ts:920`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "تم حظر حسابك",
  message: blockReason,
  type: "system",
  url: `/driver/dashboard`
});
```
**Test**:
- ✅ Admin blocks driver
- ✅ Verify driver receives notification

#### 22. حذف سائق (Soft Delete)
**File**: `artifacts/api-server/src/routes/admin.ts:1227`
```typescript
void notify({
  userId: driverId,
  userRole: "driver",
  title: "إشعار هام",
  message: deleteReason || "تم إلغاء تفعيل حسابك",
  type: "system",
  url: `/driver/support`
});
```
**Test**:
- ✅ Admin soft-deletes driver
- ✅ Verify driver receives notification

#### 23. حذف عميل (Soft Delete)
**File**: `artifacts/api-server/src/routes/admin.ts:1379`
```typescript
void notify({
  userId: clientId,
  userRole: "client",
  title: "إشعار هام",
  message: deleteReason || "تم إلغاء تفعيل حسابك",
  type: "system",
  url: `/client/support`
});
```
**Test**:
- ✅ Admin soft-deletes client
- ✅ Verify client receives notification

---

## خطة الاختبار الشاملة

### المتطلبات الأساسية
1. ✅ OneSignal configured: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
2. ✅ Database tables: `notifications`, `push_subscriptions`
3. ✅ Test accounts: client, driver, admin with push subscriptions

### خطوات الاختبار

#### A. التأكد من عمل البوابات
```bash
# 1. Test OneSignal configuration
curl http://localhost:3000/api/push/public-config

# Expected: { "oneSignalEnabled": true, "oneSignalAppId": "..." }

# 2. Test push subscription status (requires auth)
curl http://localhost:3000/api/push/status \
  -H "Cookie: session=..."

# Expected: { "hasSubscription": true/false }
```

#### B. اختبار الإشعارات الداخلية
```sql
-- Query to check all notifications
SELECT
  id, user_id, user_role, title, message, type,
  is_read, delivered_at, delivery_status, provider
FROM notifications
ORDER BY created_at DESC
LIMIT 50;
```

#### C. اختبار الإشعارات الخارجية
1. فتح التطبيق في المتصفح
2. تفعيل الإشعارات من الزر
3. التأكد من ظهور رسالة نجاح
4. تشغيل حدث معين (مثل: إنشاء طلب جديد)
5. التحقق من وصول إشعار push

#### D. اختبار جميع الأحداث (23 حدث)
| # | Event | Internal ✓ | External ✓ | Notes |
|---|-------|-----------|-----------|-------|
| 1 | New request from client | ⬜ | ⬜ | Notify all admins |
| 2 | Request published to drivers | ⬜ | ⬜ | Notify all active drivers |
| 3 | Request status updated | ⬜ | ⬜ | Notify all admins |
| 4 | Driver selected for request | ⬜ | ⬜ | Notify client |
| 5 | Driver notified of selection | ⬜ | ⬜ | Notify driver |
| 6 | Request cancelled | ⬜ | ⬜ | Notify assigned driver |
| 7 | Request edited | ⬜ | ⬜ | Notify assigned driver |
| 8 | New offer from driver | ⬜ | ⬜ | Notify client |
| 9 | New offer (admin notification) | ⬜ | ⬜ | Notify all admins |
| 10 | New message to driver | ⬜ | ⬜ | Notify driver |
| 11 | New message to client | ⬜ | ⬜ | Notify client |
| 12 | New support ticket | ⬜ | ⬜ | Notify all admins |
| 13 | Admin reply to ticket | ⬜ | ⬜ | Notify ticket owner |
| 14 | User reply to ticket | ⬜ | ⬜ | Notify assigned admin |
| 15 | New withdrawal request | ⬜ | ⬜ | Notify all admins |
| 16 | Withdrawal approved | ⬜ | ⬜ | Notify driver |
| 17 | Withdrawal rejected | ⬜ | ⬜ | Notify driver |
| 18 | New bank account | ⬜ | ⬜ | Notify all admins |
| 19 | Bank account updated | ⬜ | ⬜ | Notify all admins |
| 20 | Driver activated | ⬜ | ⬜ | Notify driver |
| 21 | Driver blocked | ⬜ | ⬜ | Notify driver |
| 22 | Driver soft-deleted | ⬜ | ⬜ | Notify driver |
| 23 | Client soft-deleted | ⬜ | ⬜ | Notify client |

---

## سكريبت الاختبار الآلي

```typescript
// test-notifications.ts
import { notify, notifyAllAdmins, notifyAllDrivers } from './artifacts/api-server/src/lib/notify';

async function testAllNotificationEvents() {
  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ event: string; status: 'pass' | 'fail'; error?: string }>
  };

  // Test 1: Individual notification
  try {
    await notify({
      userId: 1,
      userRole: "client",
      title: "Test Notification",
      message: "This is a test",
      type: "system"
    });
    results.tests.push({ event: "Individual notification", status: "pass" });
    results.passed++;
  } catch (error) {
    results.tests.push({
      event: "Individual notification",
      status: "fail",
      error: String(error)
    });
    results.failed++;
  }

  // Test 2: Broadcast to admins
  try {
    await notifyAllAdmins({
      title: "Admin Broadcast Test",
      message: "Testing admin notifications",
      type: "system"
    });
    results.tests.push({ event: "Broadcast to admins", status: "pass" });
    results.passed++;
  } catch (error) {
    results.tests.push({
      event: "Broadcast to admins",
      status: "fail",
      error: String(error)
    });
    results.failed++;
  }

  // Test 3: Broadcast to drivers
  try {
    await notifyAllDrivers({
      title: "Driver Broadcast Test",
      message: "Testing driver notifications",
      type: "system"
    });
    results.tests.push({ event: "Broadcast to drivers", status: "pass" });
    results.passed++;
  } catch (error) {
    results.tests.push({
      event: "Broadcast to drivers",
      status: "fail",
      error: String(error)
    });
    results.failed++;
  }

  console.log(`\n=== Notification Test Results ===`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`\nDetails:`);
  results.tests.forEach(test => {
    console.log(`${test.status === 'pass' ? '✅' : '❌'} ${test.event}`);
    if (test.error) console.log(`   Error: ${test.error}`);
  });
}
```

---

## الخلاصة

### التغطية الحالية ✅
- **23 حدث إشعار** محدد في الكود
- **بوابتان**: OneSignal (أساسي) + Web Push (احتياطي)
- **تخزين داخلي**: جميع الإشعارات تُحفظ في قاعدة البيانات
- **تتبع التسليم**: `deliveryStatus`, `deliveredAt`, `deliveryError`

### نقاط القوة
- ✅ جميع الأحداث المهمة مغطاة
- ✅ دعم OneSignal + Web Push fallback
- ✅ تخزين دائم في DB
- ✅ تتبع حالة التسليم
- ✅ External user IDs بصيغة `role:id`

### التوصيات للاختبار
1. ✅ اختبار كل حدث على حدة
2. ✅ التأكد من وصول الإشعارات الداخلية (DB)
3. ✅ التأكد من وصول الإشعارات الخارجية (Push)
4. ✅ اختبار السيناريوهات المختلفة (client, driver, admin)
5. ✅ مراقبة logs في `/api/push` endpoints
