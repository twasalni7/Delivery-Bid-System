import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

export interface MapCoords {
  lat: number;
  lng: number;
  address: string;
}

interface MapPickerProps {
  value: MapCoords | null;
  onChange: (coords: MapCoords) => void;
  placeholder?: string;
  color?: string;
  initialCenter?: [number, number];
}

function fixLeafletIcons(L: typeof import("leaflet")) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
      { headers: { "Accept-Language": "ar" } }
    );
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json() as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

const SAUDI_CENTER: [number, number] = [24.7136, 46.6753];

export default function MapPicker({ value, onChange, placeholder = "اضغط على الخريطة لتحديد الموقع", color = "#deff9a", initialCenter }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    setLoading(true);

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      fixLeafletIcons(L.default ?? L);
      const Lx = (L.default ?? L) as typeof import("leaflet");

      const center = initialCenter ?? SAUDI_CENTER;
      const map = Lx.map(containerRef.current!, { center, zoom: 11, zoomControl: true });

      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      setLoading(false);

      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Lx.marker([lat, lng]).addTo(map);
        }

        setGeocoding(true);
        const address = await reverseGeocode(lat, lng);
        setGeocoding(false);
        onChange({ lat, lng, address });
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then((L) => {
      const Lx = (L.default ?? L) as typeof import("leaflet");
      if (value) {
        if (markerRef.current) {
          markerRef.current.setLatLng([value.lat, value.lng]);
        } else {
          markerRef.current = Lx.marker([value.lat, value.lng]).addTo(mapRef.current);
        }
        mapRef.current.setView([value.lat, value.lng], 14);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, mapReady]);

  return (
    <div className="space-y-2">
      {/* Selected coordinates display */}
      {value && (
        <div
          className="flex items-start gap-3 p-4 rounded-[1.5rem] text-sm"
          style={{ backgroundColor: "rgba(222,255,154,0.06)", border: "1px solid rgba(222,255,154,0.2)" }}
        >
          <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white line-clamp-2">{value.address}</p>
            <p className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div ref={containerRef} style={{ height: "300px", backgroundColor: "#161616" }} />
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
            <div className="flex items-center gap-2 text-white">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-bold">جاري تحميل الخريطة...</span>
            </div>
          </div>
        )}

        {/* Geocoding indicator */}
        {geocoding && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span>جاري تحديد العنوان...</span>
          </div>
        )}

        {/* Placeholder text when no selection */}
        {!value && !loading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold text-center" style={{ backgroundColor: "rgba(0,0,0,0.8)", color: "rgba(255,255,255,0.8)", maxWidth: "80%" }}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
