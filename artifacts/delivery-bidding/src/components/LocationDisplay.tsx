/**
 * LocationDisplay.tsx — توصّلني
 * مكون يعرض العنوان: إذا كان احداثيات يحوّله تلقائياً لـ "الحي، المدينة"
 */

import { useState, useEffect } from "react";
import { isCoordinates, shortLocation, reverseGeocode } from "@/lib/location-utils";

interface LocationDisplayProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackText?: string;
}

export function LocationDisplay({
  value,
  className,
  style,
  fallbackText,
}: LocationDisplayProps) {
  const [display, setDisplay] = useState<string>(() => {
    // محاولة أولى سريعة
    const coords = isCoordinates(value);
    if (coords) return ""; // ننتظر الـ geocode
    return shortLocation(value);
  });

  useEffect(() => {
    if (!value) return;
    const coords = isCoordinates(value);
    if (coords) {
      reverseGeocode(coords.lat, coords.lng).then(setDisplay);
    } else {
      setDisplay(shortLocation(value));
    }
  }, [value]);

  if (!display) {
    return (
      <span className={className} style={{ ...style, opacity: 0.4 }}>
        {fallbackText ?? "جاري التحميل..."}
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
