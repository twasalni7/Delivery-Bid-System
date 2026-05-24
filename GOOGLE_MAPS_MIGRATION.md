# Google Maps API Integration Guide

## Overview

تم استبدال نظام الخرائط القديم (Leaflet + OpenStreetMap) بـ Google Maps API بالكامل مع الحفاظ على جميع الوظائف والمنطق والتسعير.

## What Changed

### New Components
- **GoogleMapPicker**: استبدل MapPicker بـ Google Maps مع دعم:
  - Google Places Autocomplete بالعربي
  - تقييد البحث للسعودية فقط (`componentRestrictions: { country: "sa" }`)
  - حفظ جميع البيانات: `lat`, `lng`, `formatted_address`, `district`, `city`, `place_id`
  - Lazy loading للأداء
  - دعم كامل للجوال والديسكتوب
  - RTL support

### New Libraries
- **google-maps-loader.ts**: مكتبة لتحميل Google Maps API
- **use-google-maps.ts**: React hook لإدارة تحميل Google Maps

### Updated Components
- **LocationDisplay**: يدعم الآن عرض الحي والمدينة من Google Maps data
- **CreateRequest**: يستخدم GoogleMapPicker بدلاً من MapPicker
- **MapButtons**: يستخدم روابط Google Maps (https://www.google.com/maps?q=LAT,LNG)

### Database Schema
تم توسيع الحقل `coordinates` في جدول `requests` لدعم:
- `district`: اسم الحي
- `city`: اسم المدينة
- `place_id`: Google Place ID

## Setup Instructions

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Create credentials (API Key)
5. Restrict the API key:
   - **Application restrictions**: HTTP referrers
   - Add your domains (e.g., `sharq.it.com`, `*.sharq.it.com`)
   - **API restrictions**: Restrict key to selected APIs
     - Maps JavaScript API
     - Places API
     - Geocoding API

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Server-side variable (recommended for production)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Optional: For local development, you can also set the frontend variable directly
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

**How it works:**
- The frontend first tries to use `VITE_GOOGLE_MAPS_API_KEY` if available (useful for local development)
- If not found, it fetches the API key from the backend endpoint `/api/push/google-maps-key`
- The backend serves the key from the `GOOGLE_MAPS_API_KEY` environment variable
- This approach keeps the API key secure in production environments

### 3. Deploy

No database migrations are needed. The new fields are optional and backward compatible.

## Features

### ✅ Arabic Support
- جميع واجهات البحث بالعربي
- عرض أسماء الأحياء والمدن بالعربي
- RTL layout كامل

### ✅ Saudi Arabia Only
- البحث مقيد للسعودية فقط
- نتائج دقيقة للمواقع المحلية

### ✅ Rich Location Data
كل موقع يحفظ:
- Latitude & Longitude
- Formatted address (عنوان كامل)
- District (اسم الحي)
- City (اسم المدينة)
- Place ID (معرّف Google)

### ✅ "Open in Google Maps" Buttons
زر "فتح في Google Maps" في:
- بوابة الإدارة (Admin Dashboard)
- بوابة السواقين (Driver Dashboard)
- كروت الطلبات (Request Cards)
- الجداول (Tables)

### ✅ Mobile Optimized
- تجربة ممتازة على الجوال
- Touch gestures محسّنة
- Full screen map على الجوال

### ✅ Performance
- Lazy loading للخرائط
- Loading states احترافية
- Error handling شامل

### ✅ Backward Compatible
- البيانات القديمة تعمل بدون مشاكل
- Fallback تلقائي للإحداثيات
- لا تغييرات في APIs
- لا تغييرات في التسعير
- لا تغييرات في database schema

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Build succeeds
- [ ] All request types work:
  - شخص واحد
  - عدة أشخاص
  - عدة مواقع
  - موقع وصول واحد
  - أوقات يومية مختلفة
  - شفتات متعددة
- [ ] Mobile responsiveness
- [ ] Google Maps links work
- [ ] Arabic search works
- [ ] District and city display correctly
- [ ] Current location button works
- [ ] Pricing calculations unchanged

## Troubleshooting

### Map doesn't load
- Check that `GOOGLE_MAPS_API_KEY` is set in your server environment
- Alternatively, set `VITE_GOOGLE_MAPS_API_KEY` for frontend-only development
- Verify API key has correct APIs enabled
- Check browser console for errors
- Open browser DevTools Network tab and check if `/api/push/google-maps-key` returns the key successfully

### Search doesn't work
- Ensure Places API is enabled
- Check API key restrictions
- Verify domain is allowed in API key settings

### Arabic text doesn't show
- Google Maps should automatically use Arabic for Saudi Arabia
- Check that `language: "ar"` is set in the loader

## Cost Considerations

Google Maps API has usage-based pricing:
- Maps JavaScript API: $7 per 1000 loads (first 28,000 free monthly)
- Places API Autocomplete: $2.83 per 1000 requests (first 28,000 free monthly)
- Geocoding API: $5 per 1000 requests (first 28,000 free monthly)

With the free tier, you can handle approximately **28,000 sessions per month** before any charges.

## Support

For issues or questions, contact the development team or open an issue on GitHub.
