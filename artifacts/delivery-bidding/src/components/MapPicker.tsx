import { useEffect, useRef, useState, useCallback, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, Search, X, LocateFixed, CheckCircle2, Expand, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";
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
  /** When true the map starts collapsed on desktop; user must tap a button to expand it inline. */
  collapsible?: boolean;
  openButtonLabel?: string;
  openButtonHint?: string;
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
    const res = await fetch(`${API}/api/maps/reverse?lat=${lat}&lng=${lng}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json() as { address?: string };
    return data.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

type SearchResult = {
  id: number | string;
  address: string;
  lat: number;
  lng: number;
};

// Eastern Region bounding box: SW(25.5, 49.4) → NE(27.6, 50.7)
const EASTERN_REGION_VIEWBOX = "49.4,25.5,50.7,27.6";
// Default center: Dammam, Eastern Region
const EASTERN_REGION_CENTER: [number, number] = [26.4307, 50.1037];
// Debounce delays
const SEARCH_DEBOUNCE_MS = 300;
const MOVE_END_DEBOUNCE_MS = 350;
const PROGRAMMATIC_MOVE_GUARD_MS = 150;
// ~4-6 meters in our target region (latitude-dependent): enough to ignore tiny map jitters while dragging.
// Increase only if geocoding triggers too frequently; decrease only if very small deliberate drags are missed.
const COORDINATE_EPSILON = 0.00005;

export default function MapPicker({
  value,
  onChange,
  placeholder = "ابحث عن موقع أو حرّك الخريطة",
  color = "var(--brand)",
  initialCenter,
  collapsible = false,
  openButtonLabel = "اضغط هنا لتحديد الموقع",
  openButtonHint = "سيفتح لك البحث وخريطة المعاينة",
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moveEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const programmaticMoveTimerRef = useRef<number | null>(null);
  const geocodeRequestIdRef = useRef(0);
  const programmaticMoveRef = useRef(false);
  const pendingSelectionRef = useRef<MapCoords | null>(value);
  const handleMapMoveStopRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isInlineExpanded, setIsInlineExpanded] = useState(!collapsible);
  const [isDesktopZoomed, setIsDesktopZoomed] = useState(false);
  const { toast } = useToast();

  const [pendingSelection, setPendingSelection] = useState<MapCoords | null>(value);

  // Search state
  const [searchText, setSearchText] = useState(value?.address ?? "");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const shouldRenderMap = isMobile ? isPickerOpen : (!collapsible || isInlineExpanded);
  const mapPanelMinHeight = isMobile
    ? "100%"
    : collapsible && !isPickerOpen
      ? (isDesktopZoomed ? "clamp(420px, 58vh, 560px)" : "clamp(220px, 34vh, 300px)")
      : "clamp(420px, 58vh, 560px)";

  const dismissKeyboardAndSuggestions = useCallback(() => {
    setShowResults(false);
    searchInputRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  const setMarkerAndView = useCallback((lat: number, lng: number, zoom = 16) => {
    if (!mapRef.current) return;
    programmaticMoveRef.current = true;
    mapRef.current.setView([lat, lng], zoom);
    if (programmaticMoveTimerRef.current) window.clearTimeout(programmaticMoveTimerRef.current);
    programmaticMoveTimerRef.current = window.setTimeout(() => {
      programmaticMoveRef.current = false;
    }, PROGRAMMATIC_MOVE_GUARD_MS);
  }, []);

  const applySelection = useCallback(
    (next: MapCoords) => {
      pendingSelectionRef.current = next;
      setPendingSelection((prev) => {
        if (prev && prev.lat === next.lat && prev.lng === next.lng && prev.address === next.address) return prev;
        return next;
      });
      setSearchText((prev) => (prev === next.address ? prev : next.address));
    },
    [setPendingSelection, setSearchText]
  );

  const resolveAddressForSelection = useCallback(
    async (lat: number, lng: number) => {
      const requestId = ++geocodeRequestIdRef.current;
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      if (requestId !== geocodeRequestIdRef.current) return;
      setGeocoding(false);
      applySelection({ lat, lng, address });
    },
    [applySelection]
  );

  const searchPlaces = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const url = `${API}/api/maps/search?q=${encodeURIComponent(query)}&limit=6&viewbox=${EASTERN_REGION_VIEWBOX}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const results = await res.json() as SearchResult[];
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch {
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchPlaces(val);
    }, SEARCH_DEBOUNCE_MS);
  };

  const updateSelectionFromCoordinates = useCallback(
    async (lat: number, lng: number, options?: { recenter?: boolean; zoom?: number }) => {
      const recenter = options?.recenter ?? true;
      const zoom = options?.zoom ?? 16;
      if (recenter) setMarkerAndView(lat, lng, zoom);
      const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      applySelection({ lat, lng, address: fallbackAddress });
      await resolveAddressForSelection(lat, lng);
    },
    [applySelection, resolveAddressForSelection, setMarkerAndView]
  );

  const selectSearchResult = (result: SearchResult) => {
    const lat = result.lat;
    const lng = result.lng;
    setGpsError(null);
    dismissKeyboardAndSuggestions();
    applySelection({ lat, lng, address: result.address });
    setMarkerAndView(lat, lng, 16);
  };

  const clearSearch = () => {
    setSearchText("");
    setSearchResults([]);
    setShowResults(false);
  };

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("متصفحك لا يدعم تحديد الموقع. يمكنك تحديد الموقع يدويًا من الخريطة.");
      return;
    }

    setGpsError(null);
    setLocating(true);
    dismissKeyboardAndSuggestions();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocating(false);
        await updateSelectionFromCoordinates(lat, lng, { recenter: true, zoom: 17 });
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("تم رفض إذن الموقع. يمكنك اختيار الموقع يدويًا من الخريطة.");
        } else if (err.code === err.TIMEOUT) {
          setGpsError("انتهت مهلة تحديد الموقع. جرّب مرة أخرى أو اختر يدويًا من الخريطة.");
        } else {
          setGpsError("تعذّر تحديد موقعك حالياً. يمكنك تحديد الموقع يدويًا من الخريطة.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  }, [dismissKeyboardAndSuggestions, updateSelectionFromCoordinates]);

  const handleMapTap = useCallback(async (lat: number, lng: number) => {
    setGpsError(null);
    dismissKeyboardAndSuggestions();
    await updateSelectionFromCoordinates(lat, lng, { recenter: true, zoom: 16 });
  }, [dismissKeyboardAndSuggestions, updateSelectionFromCoordinates]);

  const handleMapMoveStop = useCallback(async () => {
    if (!mapRef.current) return;
    if (programmaticMoveRef.current) return;
    if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
    const center = mapRef.current.getCenter();
    const previous = pendingSelectionRef.current;
    const almostSamePoint =
      previous &&
      Math.abs(previous.lat - center.lat) < COORDINATE_EPSILON &&
      Math.abs(previous.lng - center.lng) < COORDINATE_EPSILON;
    if (almostSamePoint) return;
    moveEndTimerRef.current = setTimeout(() => {
      void updateSelectionFromCoordinates(center.lat, center.lng, { recenter: false });
    }, MOVE_END_DEBOUNCE_MS);
  }, [updateSelectionFromCoordinates]);

  useEffect(() => {
    handleMapMoveStopRef.current = () => {
      handleMapMoveStop().catch(() => {});
    };
  }, [handleMapMoveStop]);

  const handleConfirmSelection = useCallback(() => {
    if (!pendingSelection) return;
    dismissKeyboardAndSuggestions();
    onChange(pendingSelection);
    toast({
      title: "تم تثبيت الموقع",
      description: "تم حفظ الموقع بنجاح",
    });
    if (isMobile) setIsPickerOpen(false);
  }, [dismissKeyboardAndSuggestions, isMobile, onChange, pendingSelection, toast]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!value) return;
    setPendingSelection((prev) => {
      if (prev && prev.lat === value.lat && prev.lng === value.lng && prev.address === value.address) {
        return prev;
      }
      pendingSelectionRef.current = value;
      return value;
    });
    setSearchText((prev) => (prev === value.address ? prev : value.address));
  }, [value]);

  useEffect(() => {
    if (isPickerOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isPickerOpen]);

  useEffect(() => {
    if (!isInlineExpanded) setIsDesktopZoomed(false);
  }, [isInlineExpanded]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !shouldRenderMap) return;

    let cancelled = false;
    setLoading(true);

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const Lx = L.default || L;
      fixLeafletIcons(Lx);

      const center = pendingSelection
        ? [pendingSelection.lat, pendingSelection.lng] as [number, number]
        : initialCenter ?? EASTERN_REGION_CENTER;

      const map = Lx.map(containerRef.current!, {
        center,
        zoom: pendingSelection ? 15 : 12,
        zoomControl: true,
      });

      Lx.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      setLoading(false);

      map.on("moveend", () => {
        handleMapMoveStopRef.current();
      });

      // Make sure map sizes correctly in fixed full-screen container.
      setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (moveEndTimerRef.current) clearTimeout(moveEndTimerRef.current);
      if (programmaticMoveTimerRef.current) window.clearTimeout(programmaticMoveTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRenderMap]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !pendingSelection) return;
    setMarkerAndView(pendingSelection.lat, pendingSelection.lng, 15);
  }, [mapReady, pendingSelection, setMarkerAndView]);

  // On mobile the map fills its flex-1 parent via absolute positioning.
  // On desktop the container height is driven by minHeight so we keep h-full w-full.
  const mapPanel = isMobile ? (
    <div
      className="relative flex-1 min-h-0 overflow-hidden"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ backgroundColor: "#161616", touchAction: "pan-x pan-y" }}
      />

      {loading && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
          <div className="flex items-center gap-3 text-white text-base font-black px-5 py-4 rounded-2xl" style={{ backgroundColor: "rgba(20,20,20,0.72)" }}>
            <Loader2 size={22} className="animate-spin" />
            <span>جاري تحميل الخريطة...</span>
          </div>
        </div>
      )}

      {geocoding && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black text-white" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span>جاري تحديث العنوان...</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[1150] flex items-center justify-center">
        <div className="flex flex-col items-center -translate-y-5">
          <MapPin size={36} style={{ color }} className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]" />
          <div className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ backgroundColor: color }} />
        </div>
      </div>

      {!pendingSelection && !loading && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-2xl text-sm font-black text-center" style={{ backgroundColor: "rgba(0,0,0,0.78)", color: "rgba(255,255,255,0.92)", maxWidth: "90%" }}>
          {placeholder}
        </div>
      )}
    </div>
  ) : (
    <div className="relative flex-1 min-h-0 w-full" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          minHeight: mapPanelMinHeight,
          backgroundColor: "#161616",
          touchAction: "pan-x pan-y",
        }}
      />

      {loading && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
          <div className="flex items-center gap-3 text-white text-base font-black px-5 py-4 rounded-2xl" style={{ backgroundColor: "rgba(20,20,20,0.72)" }}>
            <Loader2 size={22} className="animate-spin" />
            <span>جاري تحميل الخريطة...</span>
          </div>
        </div>
      )}

      {geocoding && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black text-white" style={{ backgroundColor: "rgba(0,0,0,0.82)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span>جاري تحديث العنوان...</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[1150] flex items-center justify-center">
        <div className="flex flex-col items-center -translate-y-5">
          <MapPin size={34} style={{ color }} className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]" />
          <div className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ backgroundColor: color }} />
        </div>
      </div>

      {!pendingSelection && !loading && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-2xl text-sm font-black text-center" style={{ backgroundColor: "rgba(0,0,0,0.78)", color: "rgba(255,255,255,0.92)", maxWidth: "90%" }}>
          {placeholder}
        </div>
      )}
    </div>
  );

  const searchBar = (
    <div className="relative w-full">
      <div className="flex items-center gap-2 px-3 rounded-2xl" style={{ backgroundColor: "var(--input-bg)", border: "1.5px solid var(--input-border)", minHeight: "56px" }}>
        {searching ? (
          <Loader2 size={20} className="shrink-0 animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <Search size={20} className="shrink-0" style={{ color: "var(--text-muted)" }} />
        )}
        <input
          ref={searchInputRef}
          type="text"
          value={searchText}
          onChange={handleSearchInput}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="ابحث عن الحي أو الشارع..."
          className="flex-1 bg-transparent py-3 text-[1.05rem] font-bold outline-none"
          style={{ color: "var(--text)", fontFamily: "var(--font-arabic)", border: "none" }}
          dir="rtl"
        />
        {searchText && (
          <button
            type="button"
            onClick={clearSearch}
            className="touch-compact shrink-0 p-2 rounded-xl"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            aria-label="مسح البحث"
          >
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {showResults && searchResults.length > 0 && (
        <div
          className="absolute z-[1400] w-full mt-2 rounded-2xl overflow-hidden max-h-[42dvh] overflow-y-auto"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
          role="listbox"
          aria-label="نتائج البحث عن المواقع"
        >
          {searchResults.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => selectSearchResult(r)}
              className="w-full flex items-start gap-3 px-4 py-4 text-right transition-colors"
              style={{ color: "var(--text-sub)", borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              dir="rtl"
              role="option"
              aria-label={r.address}
            >
              <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
              <span className="text-base font-bold line-clamp-2">{r.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {isMobile ? (
        <>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 text-right"
            style={{ border: "1px solid rgba(255,255,255,0.14)", background: "linear-gradient(130deg, rgba(17,28,46,0.85) 0%, rgba(8,13,23,0.95) 100%)" }}
          >
            <Expand size={20} style={{ color: "var(--brand)" }} />
            <div className="flex-1 min-w-0">
                <p className="text-base font-black" style={{ color: "var(--text)" }}>
                  {pendingSelection ? "تعديل الموقع المحدد" : openButtonLabel}
                </p>
                <p className="text-sm font-bold truncate" style={{ color: "var(--text-muted)" }}>
                  {pendingSelection?.address || openButtonHint}
                </p>
              </div>
            </button>

          {isPickerOpen && createPortal(
            <div
              className="fixed inset-0 z-[1200]"
              style={{ background: "radial-gradient(120% 120% at 12% 10%, rgba(32,71,122,0.25) 0%, rgba(9,13,22,0.98) 42%, #05070c 100%)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-picker-title"
            >
              <div className="flex flex-col" style={{ height: "100%" }}>
                <div
                  className="flex-shrink-0 z-[1300] px-3 pb-2 space-y-2"
                  style={{
                    paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                    background: "linear-gradient(180deg, rgba(5,8,15,0.94) 0%, rgba(5,8,15,0.85) 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        dismissKeyboardAndSuggestions();
                        setIsPickerOpen(false);
                      }}
                      className="flex items-center gap-1.5 px-4 rounded-xl font-black text-sm flex-shrink-0"
                      style={{
                        minHeight: "44px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        color: "var(--text-sub)",
                      }}
                    >
                      ← رجوع
                    </button>
                    <div className="flex-1 min-w-0">
                      <p id="map-picker-title" className="text-base font-black" style={{ color: "var(--text)" }}>حددي موقعك بدقة</p>
                      <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>حرّكي الخريطة حتى يصبح الدبوس الثابت فوق المكان المطلوب</p>
                    </div>
                  </div>
                  {searchBar}
                </div>

                {gpsError && (
                  <div className="flex-shrink-0 mx-3 my-2 rounded-2xl px-4 py-3 text-sm font-black" style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.4)", color: "#fecaca" }}>
                    {gpsError}
                  </div>
                )}

                {mapPanel}

                <div
                  className="flex-shrink-0 z-[1300] p-3 flex flex-col gap-2"
                  style={{
                    background: "linear-gradient(180deg, rgba(5,8,15,0.9) 0%, rgba(5,8,15,0.98) 100%)",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="w-full rounded-2xl px-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ minHeight: "52px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text)" }}
                  >
                    {locating ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                    <span>{locating ? "جاري تحديد موقعك..." : "📍 تحديد موقعي الحالي"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSelection}
                    disabled={!pendingSelection || geocoding || loading}
                    className="w-full rounded-2xl px-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ minHeight: "56px", background: "linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)", color: "var(--brand-fg)" }}
                  >
                    <CheckCircle2 size={22} />
                    <span>✅ تأكيد الموقع</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      ) : (
          <div className="space-y-3">
            {collapsible && !isInlineExpanded ? (
              <button
                type="button"
                onClick={() => setIsInlineExpanded(true)}
                className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 text-right"
                style={{ border: "1px solid rgba(255,255,255,0.14)", background: "linear-gradient(130deg, rgba(17,28,46,0.85) 0%, rgba(8,13,23,0.95) 100%)" }}
              >
                <Expand size={20} style={{ color: "var(--brand)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black" style={{ color: "var(--text)" }}>
                    {pendingSelection ? "تعديل الموقع المحدد" : openButtonLabel}
                  </p>
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-muted)" }}>
                    {pendingSelection?.address || openButtonHint}
                  </p>
                </div>
              </button>
            ) : null}

            {collapsible && isInlineExpanded ? (
              <button
                type="button"
                onClick={() => {
                  dismissKeyboardAndSuggestions();
                  setIsInlineExpanded(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-sm font-black"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text-sub)" }}
              >
                إغلاق الخريطة
              </button>
            ) : null}

            {(!collapsible || isInlineExpanded) && (
              <>
          <p className="text-sm font-black text-center" style={{ color: "var(--text-hint)" }}>
            ابحثي بالعنوان أو حرّكي الخريطة، ثم أكدي الموقع للمتابعة
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            {searchBar}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="w-full md:w-auto rounded-2xl px-4 py-3 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)", color: "var(--brand)" }}
            >
              {locating ? <Loader2 size={20} className="animate-spin" /> : <LocateFixed size={20} />}
              <span>{locating ? "جاري التحديد..." : "استخدام موقعي الحالي"}</span>
            </button>
          </div>

          {collapsible && !isMobile && !isDesktopZoomed && (
            <button
              type="button"
              onClick={() => setIsDesktopZoomed(true)}
              className="w-full rounded-2xl px-4 py-3 font-black text-base flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
            >
              <Expand size={18} />
              <span>تكبير الخريطة</span>
            </button>
          )}

          {collapsible && !isMobile && isDesktopZoomed && (
            <button
              type="button"
              onClick={() => setIsDesktopZoomed(false)}
              className="w-full rounded-2xl px-4 py-3 font-black text-base"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-sub)" }}
            >
              تصغير الخريطة
            </button>
          )}

          {gpsError && (
            <div className="rounded-2xl px-4 py-3 text-sm font-black" style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.4)", color: "#fecaca" }}>
              {gpsError}
            </div>
          )}

          <div
            className="flex items-start gap-3 p-4 rounded-2xl text-sm"
            style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}
          >
            <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
            <div className="flex-1 min-w-0">
              <p className="font-black text-base line-clamp-2" style={{ color: "var(--text)" }}>
                {pendingSelection?.address || "حدّد نقطة على الخريطة أو من البحث ثم اضغط تأكيد"}
              </p>
              {pendingSelection && (
                <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                  {pendingSelection.lat.toFixed(6)}, {pendingSelection.lng.toFixed(6)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={!pendingSelection || geocoding || loading}
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-black disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              تأكيد الموقع
            </button>
          </div>

          <div className="relative rounded-[1.5rem] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {mapPanel}
          </div>
              </>
            )}
        </div>
      )}
    </div>
  );
}
