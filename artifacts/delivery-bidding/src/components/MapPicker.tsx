import { useEffect, useRef, useState, useCallback, type ChangeEvent } from "react";
import { MapPin, Loader2, Search, X, LocateFixed, CheckCircle2, Expand, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
const SEARCH_DEBOUNCE_MS = 300;

export default function MapPicker({
  value,
  onChange,
  placeholder = "ابحث عن موقع أو اضغط على الخريطة",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const geocodeRequestIdRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isInlineExpanded, setIsInlineExpanded] = useState(!collapsible);
  const [isDesktopZoomed, setIsDesktopZoomed] = useState(false);
  const { toast } = useToast();

  const [pendingSelection, setPendingSelection] = useState<MapCoords | null>(value);

  // Search state
  const [searchText, setSearchText] = useState(value?.address ?? "");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const shouldRenderMap = isMobile ? isPickerOpen : (!collapsible || isInlineExpanded);

  const dismissKeyboardAndSuggestions = useCallback(() => {
    setShowResults(false);
    searchInputRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  const setMarkerAndView = useCallback((lat: number, lng: number, zoom = 16) => {
    if (!mapRef.current) return;
    void import("leaflet").then((L) => {
      const Lx = L.default || L;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = Lx.marker([lat, lng]).addTo(mapRef.current);
      }
      mapRef.current.setView([lat, lng], zoom);
    });
  }, []);

  const applySelection = useCallback(
    (next: MapCoords) => {
      setPendingSelection(next);
      setSearchText(next.address);
    },
    []
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
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=ar&viewbox=${EASTERN_REGION_VIEWBOX}&bounded=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "ar" } });
      if (!res.ok) return;
      const results = await res.json() as NominatimResult[];
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

  const selectSearchResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const next = { lat, lng, address: result.display_name };

    setGpsError(null);
    dismissKeyboardAndSuggestions();
    applySelection(next);
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
        const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        setLocating(false);
        setMarkerAndView(lat, lng, 17);
        applySelection({ lat, lng, address: fallbackAddress });
        await resolveAddressForSelection(lat, lng);
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
  }, [applySelection, dismissKeyboardAndSuggestions, resolveAddressForSelection, setMarkerAndView]);

  const handleMapTap = useCallback(async (lat: number, lng: number) => {
    setGpsError(null);
    dismissKeyboardAndSuggestions();
    setMarkerAndView(lat, lng, 16);

    // Update immediately with fallback, then reverse-geocode.
    const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    applySelection({ lat, lng, address: fallbackAddress });
    await resolveAddressForSelection(lat, lng);
  }, [applySelection, dismissKeyboardAndSuggestions, resolveAddressForSelection, setMarkerAndView]);

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

      if (pendingSelection) {
        markerRef.current = Lx.marker([pendingSelection.lat, pendingSelection.lng]).addTo(map);
      }

      mapRef.current = map;
      setMapReady(true);
      setLoading(false);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        void handleMapTap(e.latlng.lat, e.latlng.lng);
      });

      // Make sure map sizes correctly in fixed full-screen container.
      setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRenderMap, initialCenter]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !pendingSelection) return;
    setMarkerAndView(pendingSelection.lat, pendingSelection.lng, 15);
  }, [mapReady, pendingSelection, setMarkerAndView]);

  const mapPanel = (
    <div className="relative flex-1 min-h-0 w-full" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          minHeight: isMobile ? "100%" : "clamp(420px, 58vh, 560px)",
          ...(collapsible && !isMobile && !isPickerOpen
            ? { minHeight: isDesktopZoomed ? "clamp(420px, 58vh, 560px)" : "clamp(220px, 34vh, 300px)" }
            : {}),
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
              key={r.place_id}
              onClick={() => selectSearchResult(r)}
              className="w-full flex items-start gap-3 px-4 py-4 text-right transition-colors"
              style={{ color: "var(--text-sub)", borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              dir="rtl"
              role="option"
              aria-label={r.display_name}
            >
              <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
              <span className="text-base font-bold line-clamp-2">{r.display_name}</span>
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
            style={{ border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-subtle)" }}
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

          {isPickerOpen && (
            <div
              className="fixed inset-0 z-[1200]"
              style={{ backgroundColor: "var(--bg)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-picker-title"
            >
              <div className="h-[100dvh] w-full max-w-full flex flex-col overflow-hidden">
                <div className="sticky top-0 z-[1300] px-3 pt-3 pb-2 space-y-2" style={{ backgroundColor: "var(--bg)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        dismissKeyboardAndSuggestions();
                        setIsPickerOpen(false);
                      }}
                      className="px-3 py-2 rounded-xl font-black text-sm"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text-sub)" }}
                    >
                      إغلاق
                    </button>
                    <div className="flex-1">
                      <p id="map-picker-title" className="text-base font-black" style={{ color: "var(--text)" }}>حددي موقعك بدقة</p>
                      <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>اضغطي على الخريطة أو ابحثي بالعنوان</p>
                    </div>
                  </div>
                  {searchBar}
                </div>

                {gpsError && (
                  <div className="mx-3 my-2 rounded-2xl px-4 py-3 text-sm font-black" style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.4)", color: "#fecaca" }}>
                    {gpsError}
                  </div>
                )}

                {mapPanel}

                <div
                  className="sticky bottom-0 z-[1300] p-3 flex flex-col gap-2"
                  style={{
                    backgroundColor: "var(--bg)",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="w-full rounded-2xl px-4 py-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {locating ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                    <span>{locating ? "جاري تحديد موقعك..." : "استخدام موقعي الحالي"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSelection}
                    disabled={!pendingSelection || geocoding || loading}
                    className="w-full rounded-2xl px-4 py-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                  >
                    <CheckCircle2 size={20} />
                    <span>تأكيد الموقع</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
          <div className="space-y-3">
            {collapsible && !isInlineExpanded ? (
              <button
                type="button"
                onClick={() => setIsInlineExpanded(true)}
                className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 text-right"
                style={{ border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-subtle)" }}
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
            اكتب العنوان أولاً أو استخدم الخريطة المصغرة، ثم أكد الموقع للمتابعة
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

          {pendingSelection && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl text-sm"
              style={{ backgroundColor: "var(--brand-subtle)", border: "1px solid var(--brand-border)" }}
            >
              <MapPin size={18} className="shrink-0 mt-0.5" style={{ color }} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-base line-clamp-2" style={{ color: "var(--text)" }}>{pendingSelection.address}</p>
                <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                  {pendingSelection.lat.toFixed(6)}, {pendingSelection.lng.toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmSelection}
                className="shrink-0 rounded-xl px-4 py-2 text-sm font-black"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                تأكيد
              </button>
            </div>
          )}

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
