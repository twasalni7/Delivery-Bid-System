/**
 * location-utils.ts — توصّلني
 * تنسيق وعرض المواقع: نص عنوان أو احداثيات → "الحي، المدينة"
 */

const NOISE_WORDS = [
  "المملكة العربية السعودية", "السعودية", "Kingdom of Saudi Arabia",
  "Saudi Arabia", "المنطقة الشرقية", "منطقة الرياض", "منطقة مكة المكرمة",
  "محافظة الدمام", "محافظة الخبر", "محافظة الظهران",
];

const CITY_WORDS = [
  "الدمام", "الظهران", "الخبر", "القطيف", "الأحساء", "جدة",
  "الرياض", "مكة", "المدينة", "الجبيل", "بقيق", "سيهات", "صفوى",
];

/**
 * هل النص احداثيات؟ مثال: "26.36681 ,50.16668"
 */
export function isCoordinates(raw: string): { lat: number; lng: number } | null {
  const trimmed = raw?.trim() ?? "";
  // نمط: رقم، فاصلة، رقم (بأي ترتيب وأي مسافات)
  const match = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  const a = parseFloat(match[1]!);
  const b = parseFloat(match[2]!);
  // lat في السعودية: 16-32، lng: 34-56
  const lat = a >= 16 && a <= 32 ? a : b;
  const lng = b >= 34 && b <= 56 ? b : a;
  return { lat, lng };
}

/**
 * تحويل نص عنوان إلى "الحي، المدينة"
 */
export function shortLocation(raw: string): string {
  if (!raw) return "";

  // إذا احداثيات — نعرضها مباشرة (سيُعالجها useReverseGeocode)
  if (isCoordinates(raw)) return raw;

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 1)
    .filter((p) => !/^\d+$/.test(p))
    .filter((p) => !NOISE_WORDS.some((n) => p.includes(n)));

  if (parts.length === 0) return raw;
  if (parts.length === 1) return parts[0]!;

  const cityIndex = parts.findIndex((p) =>
    CITY_WORDS.some((c) => p.includes(c))
  );
  const city = cityIndex >= 0 ? parts[cityIndex]! : parts[parts.length - 1]!;
  const district = parts[0] !== city ? parts[0]! : parts[1]!;

  return district ? `${district}، ${city}` : city;
}

/** Cache بسيط للـ reverse geocoding في الذاكرة */
const geoCache = new Map<string, string>();

/**
 * Reverse geocoding باستخدام Nominatim (مجاني، عربي)
 * يرجع "الحي، المدينة" أو النص الأصلي عند الفشل
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geoCache.has(key)) return geoCache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar&zoom=16`,
      { headers: { "User-Agent": "Tawasalni/1.0" } }
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    const addr = data.address ?? {};

    const district =
      addr.neighbourhood || addr.suburb || addr.quarter || addr.residential || "";
    const city = addr.city || addr.town || addr.village || addr.county || "";

    const result = district && city
      ? `${district}، ${city}`
      : district || city || data.display_name?.split(",")[0] || `${lat},${lng}`;

    geoCache.set(key, result);
    return result;
  } catch {
    return `${lat},${lng}`;
  }
}
