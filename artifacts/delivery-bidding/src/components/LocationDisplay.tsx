/**
 * LocationDisplay.tsx — توصّلني
 * مكون يعرض العنوان: إذا كان احداثيات يحوّله تلقائياً لـ "الحي، المدينة"
 * يمنع ظهور الإحداثيات والنصوص الإنجليزية
 * يدعم بيانات Google Maps الجديدة مع fallback للبيانات القديمة
 */

import { useState, useEffect } from "react";
import { isCoordinates, shortLocation, reverseGeocode } from "@/lib/location-utils";

interface LocationDisplayProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackText?: string;
  showLoadingState?: boolean;
  // New props for Google Maps data
  district?: string;
  city?: string;
}

/**
 * Checks if a string contains mostly English characters
 */
function isEnglishText(text: string): boolean {
  if (!text) return false;
  const englishChars = text.match(/[a-zA-Z]/g);
  const totalChars = text.replace(/[\s,،.]/g, "").length;
  return englishChars && totalChars > 0 && (englishChars.length / totalChars) > 0.5;
}

/**
 * Removes English words and cleans up Arabic location names
 */
function arabicOnly(text: string): string {
  if (!text) return "";

  // Remove common English words found in addresses
  const cleanText = text
    .replace(/\b(Saudi Arabia|Kingdom|Street|Road|Avenue|Building|Floor|Unit|Unnamed|Unknown)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the result is empty or still mostly English, return fallback
  if (!cleanText || isEnglishText(cleanText)) {
    return "الموقع";
  }

  return cleanText;
}

export function LocationDisplay({
  value,
  className,
  style,
  fallbackText = "الموقع",
  showLoadingState = true,
  district,
  city,
}: LocationDisplayProps) {
  const [display, setDisplay] = useState<string>(() => {
    // If we have district and city from Google Maps, use them directly
    if (district && city) {
      return `${district}، ${city}`;
    }
    if (district || city) {
      return district || city || fallbackText;
    }

    // محاولة أولى سريعة للبيانات القديمة
    const coords = isCoordinates(value);
    if (coords) return showLoadingState ? "جاري التحميل..." : fallbackText;
    const short = shortLocation(value);
    return arabicOnly(short) || fallbackText;
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If we have district and city from Google Maps, use them
    if (district && city) {
      setDisplay(`${district}، ${city}`);
      return;
    }
    if (district || city) {
      setDisplay(district || city || fallbackText);
      return;
    }

    // Fallback to old behavior for legacy data
    if (!value) {
      setDisplay(fallbackText);
      return;
    }

    const coords = isCoordinates(value);
    if (coords) {
      setIsLoading(true);
      reverseGeocode(coords.lat, coords.lng)
        .then((result) => {
          // If reverse geocoding returns coordinates, use fallback
          if (isCoordinates(result)) {
            setDisplay(fallbackText);
          } else {
            const cleaned = arabicOnly(result);
            setDisplay(cleaned || fallbackText);
          }
        })
        .catch(() => setDisplay(fallbackText))
        .finally(() => setIsLoading(false));
    } else {
      const short = shortLocation(value);
      const cleaned = arabicOnly(short);
      setDisplay(cleaned || fallbackText);
    }
  }, [value, fallbackText, district, city]);

  if (isLoading && showLoadingState) {
    return (
      <span className={className} style={{ ...style, opacity: 0.6 }}>
        جاري التحميل...
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
