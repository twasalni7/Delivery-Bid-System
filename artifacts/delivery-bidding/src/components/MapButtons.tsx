/**
 * MapButtons.tsx — مكون موحد لأزرار الخريطة في توصّلني
 * يُستخدم في: DriverDashboard, SubmitOffer, DriverRequests
 */

import { MapPin } from "lucide-react";

interface MapButtonsProps {
  homeLat?: number | null;
  homeLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
}

export function MapButtons({ homeLat, homeLng, destLat, destLng }: MapButtonsProps) {
  if (!homeLat && !homeLng && !destLat && !destLng) return null;

  return (
    <div className="flex gap-2 flex-wrap" dir="rtl">
      {homeLat && homeLng && (
        <a
          href={`https://www.google.com/maps?q=${homeLat},${homeLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "rgba(222,255,154,0.12)",
            color: "var(--brand)",
            border: "1px solid rgba(222,255,154,0.25)",
          }}
        >
          <MapPin size={12} />
          خريطة الانطلاق
        </a>
      )}
      {destLat && destLng && (
        <a
          href={`https://www.google.com/maps?q=${destLat},${destLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "rgba(248,113,113,0.12)",
            color: "var(--status-cancelled-text)",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          <MapPin size={12} />
          خريطة الوصول
        </a>
      )}
    </div>
  );
}
