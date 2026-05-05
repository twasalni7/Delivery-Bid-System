import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Search, X, LocateFixed } from "lucide-react";
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

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

// Eastern Region bounding box: SW(25.5, 49.4) → NE(27.6, 50.7)
const EASTERN_REGION_VIEWBOX = "49.4,25.5,50.7,27.6";
// Default center: Dammam, Eastern Region
const EASTERN_REGION_CENTER: [number, number] = [26.4307, 50.1037];
// Debounce delays
const SEARCH_DEBOUNCE_MS = 400;
const GEOCODE_DEBOUNCE_MS = 1000;

export default function MapPicker({ value, onChange, placeholder = "ابحث عن موقع أو اضغط على الخريطة", color = "var(--brand)", initialCenter }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const geocodingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);

  // Search state
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchPlaces = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=ar&viewbox=${EASTERN_REGION_VIEWBOX}&bounded=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "ar" } });
      if (!res.ok) return;
      const results = await res.json() as NominatimResult[];
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchPlaces(val), SEARCH_DEBOUNCE_MS);
  };

  const selectSearchResult = async (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setShowResults(false);
    setSearchText(result.display_name);

    if (mapRef.current) {
      import("leaflet").then((L) => {
        const Lx = L.default || L;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Lx.marker([lat, lng]).addTo(mapRef.current);
        }
        mapRef.current.setView([lat, lng], 15);
      });
    }
    onChange({ lat, lng, address: result.display_name });
  };

  const clearSearch = () => {
    setSearchText("");
    setSearchResults([]);
    setShowResults(false);
  };

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocating(false);

        if (mapRef.current) {
          import("leaflet").then((L) => {
            const Lx = L.default || L;
            if (markerRef.current) {
              markerRef.current.setLatLng([lat, lng]);
            } else {
              markerRef.current = Lx.marker([lat, lng]).addTo(mapRef.current);
            }
            mapRef.current.setView([lat, lng], 16);
          });
        }

        const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange({ lat, lng, address: fallbackAddress });

        setGeocoding(true);
        const address = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setSearchText(address);
        onChange({ lat, lng, address });
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    setLoading(true);

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const Lx = L.default || L;
      fixLeafletIcons(Lx);

      const center = initialCenter ?? EASTERN_REGION_CENTER;
      const map = Lx.map(containerRef.current!, { center, zoom: 12, zoomControl: true });

      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      setLoading(false);

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Lx.marker([lat, lng]).addTo(map);
        }

        // Immediately save coordinates so they are never lost if the user
        // navigates away before the geocoding debounce fires.
        const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange({ lat, lng, address: fallbackAddress });

        // Debounce geocoding to respect Nominatim's rate limit (1 req/sec)
        // Clear any pending geocoding request
        if (geocodingTimerRef.current) {
          clearTimeout(geocodingTimerRef.current);
        }

        setGeocoding(true);

        // Debounce by 1 second to avoid rapid API calls, then update address
        geocodingTimerRef.current = setTimeout(async () => {
          const address = await reverseGeocode(lat, lng);
          setGeocoding(false);
          setSearchText(address);
          onChange({ lat, lng, address });
        }, GEOCODE_DEBOUNCE_MS);
      });
    });

    return () => {
      cancelled = true;
      if (geocodingTimerRef.current) clearTimeout(geocodingTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
    // Intentionally omit onChange and initialCenter from dependencies:
    // - onChange: Would cause map re-initialization on every parent re-render
    // - initialCenter: Only needed for initial map setup, not for updates
    // The map instance is created once and persists for the component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then((L) => {
      const Lx = L.default || L;
      if (value) {
        if (markerRef.current) {
          markerRef.current.setLatLng([value.lat, value.lng]);
        } else {
          markerRef.current = Lx.marker([value.lat, value.lng]).addTo(mapRef.current);
        }
        mapRef.current.setView([value.lat, value.lng], 14);
        // Sync the search-box text with the stored address (e.g. when the
        // component remounts after the user navigates back to this step).
        setSearchText((prev) => (prev !== "" ? prev : value.address));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, mapReady]);

  return (
    <div className="space-y-2">
      {/* ── Hint text ── */}
      <p className="text-xs font-bold text-center" style={{ color: "var(--text-hint)" }}>
        ابحث عن موقعك أو حدد الموقع من الخريطة
      </p>

      {/* ── Search input + locate button ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-2 px-3 rounded-xl" style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)" }}>
            {searching ? (
              <Loader2 size={16} className="shrink-0 animate-spin" style={{ color: "var(--text-muted)" }} />
            ) : (
              <Search size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
            )}
            <input
              type="text"
              value={searchText}
              onChange={handleSearchInput}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="ابحث في المنطقة الشرقية..."
              className="flex-1 bg-transparent py-3 text-sm outline-none"
              style={{ color: "var(--text)", fontFamily: "var(--font-arabic)", border: "none", minHeight: "auto" }}
              dir="rtl"
            />
            {searchText && (
              <button onClick={clearSearch} className="touch-compact shrink-0 p-1" style={{ minHeight: "auto", minWidth: "auto" }}>
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div
              className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
            >
              {searchResults.map((r) => (
                <button
                  key={r.place_id}
                  onClick={() => selectSearchResult(r)}
                  className="w-full flex items-start gap-2 px-4 py-3 text-right transition-colors"
                  style={{ color: "var(--text-sub)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
                  dir="rtl"
                >
                  <MapPin size={14} className="shrink-0 mt-0.5" style={{ color }} />
                  <span className="text-sm line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Locate me button */}
        <button
          onClick={handleLocateMe}
          disabled={locating}
          title="تحديد موقعي الحالي"
          className="shrink-0 flex items-center justify-center rounded-xl transition-colors disabled:opacity-60"
          style={{
            width: "48px",
            height: "48px",
            backgroundColor: "var(--brand-subtle)",
            border: "1px solid var(--brand-border)",
            color: "var(--brand)",
          }}
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>
      </div>

      {/* Selected coordinates display */}
      {value && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}
        >
          <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold line-clamp-2" style={{ color: "var(--text)" }}>{value.address}</p>
            <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          ref={containerRef}
          style={{ height: "clamp(400px, 50vw, 480px)", backgroundColor: "#161616" }}
        />
        
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
