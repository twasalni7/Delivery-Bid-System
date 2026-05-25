/**
 * MultiLocationDisplay.tsx — مكون لعرض مواقع الركاب المتعددة
 * يستخدم في: DriverDashboard, AdminRequests
 */

import { LocationDisplay } from "./LocationDisplay";
import { MapButtons } from "./MapButtons";
import { useRequestPassengers } from "@/hooks/use-request-passengers";

interface MultiLocationDisplayProps {
  requestId: number;
  fallbackPickup?: string;
  fallbackPickupLat?: number | null;
  fallbackPickupLng?: number | null;
  fallbackDestination?: string;
  fallbackDestLat?: number | null;
  fallbackDestLng?: number | null;
  showMapButtons?: boolean;
  compact?: boolean;
}

export function MultiLocationDisplay({
  requestId,
  fallbackPickup,
  fallbackPickupLat,
  fallbackPickupLng,
  fallbackDestination,
  fallbackDestLat,
  fallbackDestLng,
  showMapButtons = true,
  compact = false,
}: MultiLocationDisplayProps) {
  const { data: passengers = [], isLoading } = useRequestPassengers(requestId);

  // If we have passenger data, use it
  if (passengers.length > 0) {
    const uniquePickups = new Map<string, { lat: number; lng: number; address?: string }>();
    const uniqueDestinations = new Map<string, { lat: number; lng: number; address?: string }>();

    passengers.forEach((p) => {
      if (p.pickupLat != null && p.pickupLng != null) {
        const key = `${p.pickupLat},${p.pickupLng}`;
        if (!uniquePickups.has(key)) {
          uniquePickups.set(key, {
            lat: p.pickupLat,
            lng: p.pickupLng,
            address: p.pickupAddress || undefined,
          });
        }
      }
      if (p.destinationLat != null && p.destinationLng != null) {
        const key = `${p.destinationLat},${p.destinationLng}`;
        if (!uniqueDestinations.has(key)) {
          uniqueDestinations.set(key, {
            lat: p.destinationLat,
            lng: p.destinationLng,
            address: p.destinationAddress || undefined,
          });
        }
      }
    });

    const pickupLocations = Array.from(uniquePickups.values());
    const destinationLocations = Array.from(uniqueDestinations.values());

    return (
      <div className="space-y-3">
        {/* Display pickup locations */}
        {pickupLocations.length > 0 && (
          <div className="space-y-2">
            {!compact && pickupLocations.length > 1 && (
              <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                🏠 مواقع الانطلاق ({pickupLocations.length})
              </p>
            )}
            {compact && pickupLocations.length === 1 ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: "#10B981" }}
                />
                <LocationDisplay
                  value={pickupLocations[0]!.address || `${pickupLocations[0]!.lat},${pickupLocations[0]!.lng}`}
                  className="text-sm font-black"
                  style={{ color: "#111827" }}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                {pickupLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: "#10B981" }}
                    />
                    <LocationDisplay
                      value={loc.address || `${loc.lat},${loc.lng}`}
                      className="text-sm font-black"
                      style={{ color: "#111827" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Display destination locations */}
        {destinationLocations.length > 0 && (
          <div className="space-y-2">
            {!compact && destinationLocations.length > 1 && (
              <p className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                🎯 مواقع الوصول ({destinationLocations.length})
              </p>
            )}
            {compact && destinationLocations.length === 1 ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: "#EF4444" }}
                />
                <LocationDisplay
                  value={destinationLocations[0]!.address || `${destinationLocations[0]!.lat},${destinationLocations[0]!.lng}`}
                  className="text-sm font-black"
                  style={{ color: "#111827" }}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                {destinationLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: "#EF4444" }}
                    />
                    <LocationDisplay
                      value={loc.address || `${loc.lat},${loc.lng}`}
                      className="text-sm font-black"
                      style={{ color: "#111827" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map buttons */}
        {showMapButtons && (
          <MapButtons
            pickupLocations={pickupLocations.map((loc, idx) => ({
              ...loc,
              label: pickupLocations.length > 1 ? `انطلاق ${idx + 1}` : undefined,
            }))}
            dropoffLocations={destinationLocations.map((loc, idx) => ({
              ...loc,
              label: destinationLocations.length > 1 ? `وصول ${idx + 1}` : undefined,
            }))}
            compact={compact}
          />
        )}
      </div>
    );
  }

  // Fallback to single location if no passenger data
  if (isLoading) {
    return <p className="text-sm" style={{ color: "var(--text-muted)", opacity: 0.6 }}>جاري التحميل...</p>;
  }

  return (
    <div className="space-y-3">
      {fallbackPickup && (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: "#10B981" }}
          />
          <LocationDisplay
            value={fallbackPickup}
            className="text-sm font-black"
            style={{ color: "#111827" }}
          />
        </div>
      )}
      {fallbackDestination && (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: "#EF4444" }}
          />
          <LocationDisplay
            value={fallbackDestination}
            className="text-sm font-black"
            style={{ color: "#111827" }}
          />
        </div>
      )}
      {showMapButtons && (
        <MapButtons
          homeLat={fallbackPickupLat}
          homeLng={fallbackPickupLng}
          homeAddress={fallbackPickup}
          destLat={fallbackDestLat}
          destLng={fallbackDestLng}
          destAddress={fallbackDestination}
          compact={compact}
        />
      )}
    </div>
  );
}
