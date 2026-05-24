/**
 * MapButtons.tsx — مكون موحد لأزرار الخريطة في توصّلني
 * يُستخدم في: DriverDashboard, SubmitOffer, DriverRequests
 * يدعم المواقع المتعددة للركاب
 */

import { MapPin } from "lucide-react";

interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
  label?: string;
}

interface MapButtonsProps {
  // Legacy single location support (for backward compatibility)
  homeLat?: number | null;
  homeLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;

  // New multiple locations support
  pickupLocations?: LocationPoint[];
  dropoffLocations?: LocationPoint[];

  // Styling
  compact?: boolean;
}

export function MapButtons({
  homeLat,
  homeLng,
  destLat,
  destLng,
  pickupLocations = [],
  dropoffLocations = [],
  compact = false,
}: MapButtonsProps) {
  // Build unified pickup list
  const allPickups: LocationPoint[] = [];
  if (homeLat && homeLng) {
    allPickups.push({ lat: homeLat, lng: homeLng, label: "موقع الانطلاق" });
  }
  allPickups.push(...pickupLocations);

  // Build unified dropoff list
  const allDropoffs: LocationPoint[] = [];
  if (destLat && destLng) {
    allDropoffs.push({ lat: destLat, lng: destLng, label: "موقع الوصول" });
  }
  allDropoffs.push(...dropoffLocations);

  if (allPickups.length === 0 && allDropoffs.length === 0) return null;

  return (
    <div className="space-y-3" dir="rtl">
      {/* Pickup locations */}
      {allPickups.length > 0 && (
        <div className="space-y-2">
          {allPickups.length > 1 && !compact && (
            <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
              🏠 مواقع الانطلاق ({allPickups.length})
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {allPickups.map((loc, idx) => (
              <a
                key={`pickup-${idx}`}
                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "#E8F5E9",
                  color: "#2E7D32",
                  border: "2px solid #81C784",
                }}
                title={loc.address || `${loc.lat}, ${loc.lng}`}
              >
                <MapPin size={13} />
                {loc.label || (allPickups.length > 1 ? `انطلاق ${idx + 1}` : "فتح في الخرائط")}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Dropoff locations */}
      {allDropoffs.length > 0 && (
        <div className="space-y-2">
          {allDropoffs.length > 1 && !compact && (
            <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
              🎯 مواقع الوصول ({allDropoffs.length})
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {allDropoffs.map((loc, idx) => (
              <a
                key={`dropoff-${idx}`}
                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "#FFEBEE",
                  color: "#C62828",
                  border: "2px solid #EF5350",
                }}
                title={loc.address || `${loc.lat}, ${loc.lng}`}
              >
                <MapPin size={13} />
                {loc.label || (allDropoffs.length > 1 ? `وصول ${idx + 1}` : "فتح في الخرائط")}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
