/**
 * location-utils.ts — توصّلني
 * 
 * دالة لتنسيق العنوان: تستخرج المنطقة والحي والشارع من النص الكامل
 * مثال: "الخالدية الشمالية, الظهران, الدمام, محافظة الدمام, المنطقة الشرقية, 32232, السعودية"
 * تُعيد: { area: "المنطقة الشرقية", district: "الخالدية الشمالية", street: "الظهران" }
 */

export interface ParsedLocation {
  area: string;      // المنطقة / المدينة
  district: string;  // الحي
  street: string;    // الشارع / أقرب تفصيل
  full: string;      // النص الكامل كما هو
}

const NOISE_WORDS = [
  "المملكة العربية السعودية", "السعودية", "Kingdom of Saudi Arabia",
  "Saudi Arabia", "المنطقة الشرقية", "منطقة الرياض", "منطقة مكة المكرمة",
];

const CITY_WORDS = ["الدمام", "الظهران", "الخبر", "القطيف", "الأحساء", "جدة", "الرياض", "مكة", "المدينة", "الجبيل", "بقيق"];

/**
 * يحوّل نص العنوان الكامل إلى أجزاء منظمة
 */
export function parseLocation(raw: string): ParsedLocation {
  if (!raw) return { area: "", district: "", street: "", full: "" };

  // إذا كان احداثيات فقط (رقمين) — نعيده كما هو
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(raw.trim())) {
    return { area: "", district: "", street: "", full: raw };
  }

  // نقسّم بالفاصلة ونزيل الفراغات والأرقام البريدية
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !/^\d+$/.test(p)) // نزيل الأرقام البريدية
    .filter((p) => !NOISE_WORDS.some((n) => p.includes(n)));

  if (parts.length === 0) return { area: "", district: "", street: "", full: raw };
  if (parts.length === 1) return { area: parts[0]!, district: "", street: "", full: raw };

  // نحدد المدينة
  const cityIndex = parts.findIndex((p) => CITY_WORDS.some((c) => p.includes(c)));
  const city = cityIndex >= 0 ? parts[cityIndex]! : parts[parts.length - 1]!;

  // الحي = أول جزء (أقرب للمستخدم)
  const district = parts[0]!;

  // الشارع = الجزء الثاني إن وُجد وليس مدينة
  const street = parts.length > 2 && parts[1] !== city ? parts[1]! : "";

  return {
    area: city,
    district: district !== city ? district : "",
    street,
    full: raw,
  };
}

/**
 * يعرض العنوان بشكل مختصر: "الحي، المدينة"
 */
export function shortLocation(raw: string): string {
  const p = parseLocation(raw);
  if (!p.district && !p.area) return raw;
  if (!p.district) return p.area;
  if (!p.area) return p.district;
  return `${p.district}، ${p.area}`;
}
