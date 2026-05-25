/**
 * MapButtons.tsx — مكون موحد لأزرار الخريطة في توصّلني
 * يُستخدم في: DriverDashboard, SubmitOffer, DriverRequests
 * يدعم المواقع المتعددة للركاب
 */

import { MapPin } from "lucide-react";

interface LocationPoint {
  lat?: number | string | null;
  lng?: number | string | null;
  address?: string;
  label?: string;
}

interface MapButtonsProps {
  // Legacy single location support (for backward compatibility)
  homeLat?: number | string | null;
  homeLng?: number | string | null;
  destLat?: number | string | null;
  destLng?: number | string | null;
  homeAddress?: string | null;
  destAddress?: string | null;

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
  homeAddress,
  destAddress,
  pickupLocations = [],
  dropoffLocations = [],
  compact = false,
}: MapButtonsProps) {
  const toFiniteNumber = (value: number | string | null | undefined): number | null => {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildMapLink = (location: LocationPoint): string | null => {
    const lat = toFiniteNumber(location.lat);
    const lng = toFiniteNumber(location.lng);
    if (lat != null && lng != null) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    if (location.address?.trim()) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address.trim())}`;
    }
    return null;
  };

  const buildLocationTitle = (location: LocationPoint): string => {
    if (location.address?.trim()) return location.address.trim();
    const lat = toFiniteNumber(location.lat);
    const lng = toFiniteNumber(location.lng);
    if (lat != null && lng != null) return `${lat}, ${lng}`;
    return "الموقع";
  };

  // Build unified pickup list
  const allPickups: LocationPoint[] = [];
  if (
    (toFiniteNumber(homeLat) != null && toFiniteNumber(homeLng) != null) ||
    (homeAddress && homeAddress.trim())
  ) {
    allPickups.push({
      lat: homeLat,
      lng: homeLng,
      address: homeAddress ?? undefined,
      label: "موقع الانطلاق",
    });
  }
  allPickups.push(...pickupLocations);

  // Build unified dropoff list
  const allDropoffs: LocationPoint[] = [];
  if (
    (toFiniteNumber(destLat) != null && toFiniteNumber(destLng) != null) ||
    (destAddress && destAddress.trim())
  ) {
    allDropoffs.push({
      lat: destLat,
      lng: destLng,
      address: destAddress ?? undefined,
      label: "موقع الوصول",
    });
  }
  allDropoffs.push(...dropoffLocations);

  const visiblePickups = allPickups
    .map((loc) => ({ ...loc, href: buildMapLink(loc) }))
    .filter((loc): loc is LocationPoint & { href: string } => typeof loc.href === "string");
  const visibleDropoffs = allDropoffs
    .map((loc) => ({ ...loc, href: buildMapLink(loc) }))
    .filter((loc): loc is LocationPoint & { href: string } => typeof loc.href === "string");

  if (visiblePickups.length === 0 && visibleDropoffs.length === 0) return null;

  return (
    <div className="space-y-3" dir="rtl">
      {/* Pickup locations */}
      {visiblePickups.length > 0 && (
        <div className="space-y-2">
          {visiblePickups.length > 1 && !compact && (
            <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
              🏠 مواقع الانطلاق ({visiblePickups.length})
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {visiblePickups.map((loc, idx) => (
              <a
                key={`pickup-${idx}`}
                href={loc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "#E8F5E9",
                  color: "#2E7D32",
                  border: "2px solid #81C784",
                }}
                title={buildLocationTitle(loc)}
              >
                <MapPin size={13} />
                {loc.label || (visiblePickups.length > 1 ? `انطلاق ${idx + 1}` : "فتح في الخرائط")}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Dropoff locations */}
      {visibleDropoffs.length > 0 && (
        <div className="space-y-2">
          {visibleDropoffs.length > 1 && !compact && (
            <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
              🎯 مواقع الوصول ({visibleDropoffs.length})
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {visibleDropoffs.map((loc, idx) => (
              <a
                key={`dropoff-${idx}`}
                href={loc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "#FFEBEE",
                  color: "#C62828",
                  border: "2px solid #EF5350",
                }}
                title={buildLocationTitle(loc)}
              >
                <MapPin size={13} />
                {loc.label || (visibleDropoffs.length > 1 ? `وصول ${idx + 1}` : "فتح في الخرائط")}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
