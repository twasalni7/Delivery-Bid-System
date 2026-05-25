/**
 * GoogleMapPicker.tsx — Google Maps picker with Places Autocomplete
 * Replaces MapPicker.tsx with Google Maps API
 * Features:
 * - Google Places Autocomplete (Arabic, Saudi Arabia only)
 * - Save: latitude, longitude, formatted_address, district, city, place_id
 * - Current location button
 * - Mobile & desktop responsive
 * - Lazy loading & loading states
 * - RTL support
 */

import { useEffect, useRef, useState, useCallback, useMemo, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, Search, X, LocateFixed, CheckCircle2, Expand, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import MapPicker from "@/components/MapPicker";

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export interface GoogleMapCoords {
  lat: number;
  lng: number;
  address: string;
  district?: string;
  city?: string;
  place_id?: string;
}

interface GoogleMapPickerProps {
  value: GoogleMapCoords | null;
  onChange: (coords: GoogleMapCoords) => void;
  placeholder?: string;
  color?: string;
  initialCenter?: [number, number];
  collapsible?: boolean;
  openButtonLabel?: string;
  openButtonHint?: string;
}

// Default center: Dammam, Eastern Region
const DEFAULT_CENTER: [number, number] = [26.4307, 50.1037];
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 16;

export default function GoogleMapPicker({
  value,
  onChange,
  placeholder = "ابحث عن موقع أو حرّك الخريطة",
  color = "var(--brand)",
  initialCenter,
  collapsible = false,
  openButtonLabel = "اضغط هنا لتحديد الموقع",
  openButtonHint = "سيفتح لك البحث وخريطة المعاينة",
}: GoogleMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const programmaticMoveRef = useRef(false);
  // Ref kept in sync with pendingSelection every render so the map-init effect can
  // read the current value without declaring it as a dependency (avoids destroying
  // and re-creating the map on every drag/geocode update).
  const pendingSelectionRef = useRef<GoogleMapCoords | null>(null);
  // Capture the initial center once at mount time so that inline arrays passed as
  // `initialCenter` props don't cause the map to reinitialize on every render.
  const initialCenterRef = useRef<{ lat: number; lng: number }>(
    initialCenter
      ? { lat: initialCenter[0], lng: initialCenter[1] }
      : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }
  );

  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 769px) and (max-width: 1024px)").matches
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isInlineExpanded, setIsInlineExpanded] = useState(!collapsible);
  const [isDesktopZoomed, setIsDesktopZoomed] = useState(false);
  const { toast } = useToast();

  const [pendingSelection, setPendingSelection] = useState<GoogleMapCoords | null>(value);
  const [searchText, setSearchText] = useState(value?.address ?? "");

  const shouldRenderMap = isMobile ? isPickerOpen : (!collapsible || isInlineExpanded);

  // Always start loading the Maps API as soon as this component mounts so the map
  // opens instantly when the user taps / expands it.  The actual Map DOM object is
  // only created when shouldRenderMap becomes true (see the init useEffect below).
  const { isLoaded: mapsLoaded, isLoading: mapsLoading, error: mapsError } = useGoogleMaps({
    enabled: true,
  });

  // Keep the ref in sync with the latest pendingSelection on every render.
  // Done as a plain assignment (not in a useEffect) so it is always current.
  pendingSelectionRef.current = pendingSelection;

  const dismissKeyboardAndSuggestions = useCallback(() => {
    searchInputRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  const setMarkerAndView = useCallback((lat: number, lng: number, zoom = SELECTED_ZOOM) => {
    if (!mapRef.current) return;
    const position = { lat, lng };
    programmaticMoveRef.current = true;
    mapRef.current.panTo(position);
    mapRef.current.setZoom(zoom);

    // Update or create marker
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: false,
        title: "الموقع المحدد",
      });
    } else {
      markerRef.current.setPosition(position);
    }

    setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 600);
  }, []);

  const extractLocationDetails = useCallback((
    place: google.maps.places.PlaceResult,
    lat: number,
    lng: number
  ): GoogleMapCoords => {
    const addressComponents = place.address_components || [];
    let district = "";
    let city = "";

    // Extract district (neighborhood/sublocality) and city
    for (const component of addressComponents) {
      const types = component.types;

      if (types.includes("sublocality") || types.includes("neighborhood") || types.includes("sublocality_level_1")) {
        district = component.long_name;
      }

      if (types.includes("locality") || types.includes("administrative_area_level_2")) {
        city = component.long_name;
      }
    }

    return {
      lat,
      lng,
      address: place.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      district: district || undefined,
      city: city || undefined,
      place_id: place.place_id || undefined,
    };
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<GoogleMapCoords> => {
    if (!geocoderRef.current) {
      return {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }

    try {
      const response = await geocoderRef.current.geocode({
        location: { lat, lng },
        language: "ar",
      });

      if (response.results && response.results.length > 0) {
        const place = response.results[0];
        return extractLocationDetails(place!, lat, lng);
      }

      return {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      return {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }, [extractLocationDetails]);

  const updateSelectionFromCoordinates = useCallback(
    async (lat: number, lng: number, recenter = true, zoom = SELECTED_ZOOM) => {
      if (recenter) setMarkerAndView(lat, lng, zoom);

      setGeocoding(true);
      const coords = await reverseGeocode(lat, lng);
      setGeocoding(false);

      setPendingSelection(coords);
      setSearchText(coords.address);
    },
    [reverseGeocode, setMarkerAndView]
  );

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
        await updateSelectionFromCoordinates(lat, lng, true, 17);
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

  // Inject global styles for Google Places autocomplete
  useEffect(() => {
    // Create style element for pac-container customization
    const styleId = 'google-places-autocomplete-mobile-styles';

    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Google Places Autocomplete Mobile Optimization */
        .pac-container {
          z-index: 9999 !important;
          position: fixed !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3) !important;
          border: 1px solid var(--border) !important;
          background: var(--surface) !important;
          font-family: var(--font-arabic) !important;
          margin-top: 4px !important;
          overflow: hidden !important;
        }

        .pac-container::after {
          display: none !important;
        }

        .pac-item {
          cursor: pointer !important;
          padding: 12px 16px !important;
          border-top: 1px solid var(--border-subtle) !important;
          font-size: 15px !important;
          line-height: 1.5 !important;
          color: var(--text) !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .pac-item:first-child {
          border-top: none !important;
        }

        .pac-item:hover,
        .pac-item:active,
        .pac-item-selected {
          background-color: var(--brand-subtle) !important;
        }

        .pac-item-query {
          font-weight: 700 !important;
          color: var(--text) !important;
          font-size: 15px !important;
        }

        .pac-matched {
          font-weight: 900 !important;
          color: var(--brand) !important;
        }

        .pac-icon {
          margin-left: 12px !important;
          margin-right: 0 !important;
          background-position: center !important;
        }

        /* Mobile-specific improvements */
        @media (max-width: 768px) {
          .pac-container {
            max-width: calc(100vw - 24px) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
          }

          .pac-item {
            min-height: 48px !important;
            padding: 14px 16px !important;
            font-size: 16px !important;
            display: flex !important;
            align-items: center !important;
          }

          .pac-item-query {
            font-size: 16px !important;
          }

          .pac-icon {
            width: 24px !important;
            height: 24px !important;
            margin-left: 16px !important;
          }
        }

        /* Tablet optimization */
        @media (min-width: 769px) and (max-width: 1024px) {
          .pac-item {
            min-height: 44px !important;
            padding: 12px 14px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      // Keep styles for the session but allow cleanup if needed
    };
  }, []);

  // Update media query listeners for responsive breakpoints
  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 768px)");
    const tabletMedia = window.matchMedia("(min-width: 769px) and (max-width: 1024px)");

    const applyMobile = () => setIsMobile(mobileMedia.matches);
    const applyTablet = () => setIsTablet(tabletMedia.matches);

    applyMobile();
    applyTablet();

    mobileMedia.addEventListener("change", applyMobile);
    tabletMedia.addEventListener("change", applyTablet);

    return () => {
      mobileMedia.removeEventListener("change", applyMobile);
      tabletMedia.removeEventListener("change", applyTablet);
    };
  }, []);

  // Update pending selection when value changes
  useEffect(() => {
    if (!value) return;
    setPendingSelection(value);
    setSearchText(value.address);
  }, [value]);

  // Lock body scroll when mobile picker is open
  useEffect(() => {
    if (isPickerOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isPickerOpen]);

  // Reset desktop zoom when collapsed
  useEffect(() => {
    if (!isInlineExpanded) setIsDesktopZoomed(false);
  }, [isInlineExpanded]);

  // Initialize map and autocomplete.
  // IMPORTANT: `pendingSelection` and `initialCenter` are intentionally NOT in the
  // dependency array.  Both are read via refs so that the map is never destroyed and
  // re-created just because the user dragged (which updates pendingSelection) or
  // because the parent re-rendered with a new inline array for initialCenter.
  // The map is only (re-)initialized when the render conditions change
  // (shouldRenderMap, mapsLoaded) or when the breakpoint flips (isMobile).
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !shouldRenderMap) return;

    // Wait until Google Maps is fully loaded
    if (!mapsLoaded || !window.google?.maps?.places) {
      console.log("[GoogleMapPicker] Waiting for Google Maps to load...");
      return;
    }

    setLoading(true);
    let observerInstance: MutationObserver | null = null;

    // Read current values via refs so they aren't deps of this effect.
    const currentPending = pendingSelectionRef.current;
    const center = currentPending
      ? { lat: currentPending.lat, lng: currentPending.lng }
      : initialCenterRef.current;

    try {
      // Initialize map
      const map = new google.maps.Map(containerRef.current, {
        center,
        zoom: currentPending ? 15 : DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
      });

      mapRef.current = map;

      // Initialize marker if there's a pending selection
      if (currentPending) {
        markerRef.current = new google.maps.Marker({
          map,
          position: { lat: currentPending.lat, lng: currentPending.lng },
          draggable: false,
          title: "الموقع المحدد",
        });
      }

      // Initialize geocoder
      geocoderRef.current = new google.maps.Geocoder();

      // Initialize autocomplete with mobile-optimized settings
      if (searchInputRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: "sa" },
          fields: ["address_components", "formatted_address", "geometry", "place_id"],
          types: ["establishment", "geocode"],
        });

        // Set autocomplete dropdown z-index to be above everything
        // Google Places autocomplete creates a .pac-container div
        const observeAutocomplete = () => {
          const pacContainers = document.querySelectorAll('.pac-container');
          pacContainers.forEach(container => {
            (container as HTMLElement).style.zIndex = '9999';
            (container as HTMLElement).style.position = 'fixed';

            // Ensure items are tappable on mobile
            const items = container.querySelectorAll('.pac-item');
            items.forEach(item => {
              (item as HTMLElement).style.cursor = 'pointer';
              (item as HTMLElement).style.minHeight = isMobile ? '48px' : '40px';
              (item as HTMLElement).style.padding = isMobile ? '12px 16px' : '8px 12px';
              (item as HTMLElement).style.fontSize = isMobile ? '16px' : '14px';
              (item as HTMLElement).style.touchAction = 'manipulation';
            });
          });
        };

        // Observe DOM for autocomplete dropdown creation
        observerInstance = new MutationObserver(observeAutocomplete);
        observerInstance.observe(document.body, { childList: true, subtree: true });

        autocomplete.addListener("place_changed", async () => {
          const place = autocomplete.getPlace();

          if (!place.geometry || !place.geometry.location) {
            return;
          }

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const coords = extractLocationDetails(place, lat, lng);

          setPendingSelection(coords);
          setSearchText(coords.address);
          setMarkerAndView(lat, lng, SELECTED_ZOOM);
          setGpsError(null);

          // Dismiss keyboard and suggestions after selection
          dismissKeyboardAndSuggestions();
        });

        autocompleteRef.current = autocomplete;
      }

      // Handle map drag
      map.addListener("dragend", async () => {
        if (programmaticMoveRef.current) return;

        const center = map.getCenter();
        if (!center) return;

        const lat = center.lat();
        const lng = center.lng();
        await updateSelectionFromCoordinates(lat, lng, false);
      });

      setLoading(false);
      console.log("[GoogleMapPicker] Map initialized successfully");
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setLoading(false);
      toast({
        title: "خطأ في تحميل الخريطة",
        description: "تعذر تحميل الخريطة. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }

    return () => {
      // Cleanup
      if (observerInstance) {
        observerInstance.disconnect();
      }
      if (mapRef.current) {
        markerRef.current?.setMap(null);
        markerRef.current = null;
        autocompleteRef.current = null;
        mapRef.current = null;
      }
    };
    // pendingSelection and initialCenter are intentionally excluded — they are read
    // via refs inside the effect so the map is not destroyed on every drag or re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRenderMap, mapsLoaded, extractLocationDetails, setMarkerAndView, toast, updateSelectionFromCoordinates, dismissKeyboardAndSuggestions, isMobile]);

  // Show error if Google Maps failed to load (only after loading attempt is complete)
  if (mapsError && !mapsLoading) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
          <p className="text-sm font-black" style={{ color: "#B45309" }}>
            ⚠️ تعذّر تحميل خرائط Google — تم التحويل إلى الخريطة البديلة
          </p>
          <p className="text-xs font-bold" style={{ color: "#92400E" }}>
            {mapsError.message}
          </p>
        </div>
        <MapPicker
          value={value ? { lat: value.lat, lng: value.lng, address: value.address } : null}
          onChange={(coords) => onChange({ lat: coords.lat, lng: coords.lng, address: coords.address })}
          placeholder={placeholder}
          color={color}
          initialCenter={initialCenter}
          collapsible={collapsible}
          openButtonLabel={openButtonLabel}
          openButtonHint={openButtonHint}
        />
      </div>
    );
  }

  const mapPanelMinHeight = isMobile
    ? "100%"
    : collapsible && !isPickerOpen
      ? (isDesktopZoomed ? "clamp(420px, 58vh, 560px)" : "clamp(220px, 34vh, 300px)")
      : "clamp(420px, 58vh, 560px)";

  const mapPanel = (
    <div
      className={isMobile ? "relative flex-1 min-h-0 overflow-hidden" : "relative w-full"}
      style={{
        borderTop: "1px solid var(--border-subtle)",
        minHeight: isMobile ? undefined : mapPanelMinHeight,
        height: isMobile ? undefined : mapPanelMinHeight,
      }}
    >
      <div
        ref={containerRef}
        className={isMobile ? "absolute inset-0" : "w-full h-full"}
        style={{
          backgroundColor: "#e8e0d8",
          touchAction: "pan-x pan-y",
        }}
      />

      {(loading || mapsLoading) && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="flex items-center gap-3 text-white text-base font-black px-6 py-4 rounded-2xl" style={{ backgroundColor: "rgba(20,20,20,0.8)", backdropFilter: "blur(10px)" }}>
            <Loader2 size={22} className="animate-spin" />
            <span style={{ fontFamily: "var(--font-arabic)" }}>جاري تحميل الخريطة...</span>
          </div>
        </div>
      )}

      {geocoding && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-black text-white" style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontFamily: "var(--font-arabic)" }}>جاري تحديث العنوان...</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[1150] flex items-center justify-center">
        <div className="flex flex-col items-center -translate-y-5">
          <div style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5)) drop-shadow(0 0 6px rgba(255,255,255,0.4))" }}>
            <MapPin size={40} style={{ color }} strokeWidth={2.5} />
          </div>
          <div className="mt-1 h-3 w-3 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: color }} />
        </div>
      </div>

      {!pendingSelection && !loading && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2.5 rounded-2xl text-sm font-black text-center" style={{ backgroundColor: "rgba(0,0,0,0.80)", color: "rgba(255,255,255,0.95)", maxWidth: "90%", backdropFilter: "blur(10px)", fontFamily: "var(--font-arabic)" }}>
          {placeholder}
        </div>
      )}
    </div>
  );

  const searchBar = (
    <div className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 rounded-2xl"
        style={{
          backgroundColor: "var(--input-bg)",
          border: "2px solid var(--input-border)",
          minHeight: isMobile ? "56px" : "52px",
          // Ensure this stays on top
          position: "relative",
          zIndex: 10,
        }}
      >
        <Search size={isMobile ? 22 : 20} className="shrink-0" style={{ color: "var(--text-muted)" }} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchText}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
          placeholder={isMobile ? "ابحث عن الحي أو المكان..." : "اكتب اسم الحي أو المستشفى أو المدرسة..."}
          className="flex-1 bg-transparent py-3 font-bold outline-none"
          style={{
            color: "var(--text)",
            fontFamily: "var(--font-arabic)",
            border: "none",
            fontSize: isMobile ? "16px" : "15px", // 16px prevents zoom on iOS
            // Prevent unwanted mobile behaviors
            WebkitAppearance: "none",
            touchAction: "manipulation",
          }}
          dir="rtl"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => {
              setSearchText("");
              searchInputRef.current?.focus();
            }}
            className="shrink-0 p-2 rounded-xl"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
              minWidth: isMobile ? "44px" : "auto",
              minHeight: isMobile ? "44px" : "auto",
              touchAction: "manipulation",
            }}
            aria-label="مسح البحث"
          >
            <X size={isMobile ? 18 : 16} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {!searchText && !isMobile && (
        <p className="text-xs font-bold px-1 mt-1" style={{ color: "var(--text-hint)" }}>
          💡 ابحث عن الحي أو المكان — مثال: "حي النزهة" أو "مستشفى الملك فهد"
        </p>
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
            style={{ border: "2px solid var(--brand-border)", backgroundColor: "var(--brand-subtle)" }}
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
              className="fixed inset-0"
              style={{
                backgroundColor: "var(--bg)",
                zIndex: 9998, // Below autocomplete dropdown (9999) but above everything else
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-picker-title"
            >
              <div className="flex flex-col" style={{ height: "100%", isolation: "isolate" }}>
                {/* Fixed header with search - always visible even when keyboard is open */}
                <div
                  className="flex-shrink-0 px-3 pb-2 space-y-2"
                  style={{
                    paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                    backgroundColor: "var(--surface)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky",
                    top: 0,
                    zIndex: 100, // Above map but below autocomplete
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
                        minWidth: "44px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-2)",
                        color: "var(--text-sub)",
                        touchAction: "manipulation",
                      }}
                    >
                      ← رجوع
                    </button>
                    <div className="flex-1 min-w-0">
                      <p id="map-picker-title" className="text-base font-black" style={{ color: "var(--text)" }}>حدد موقعك بدقة</p>
                      <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>ابحث باسم المكان أو حرّك الخريطة</p>
                    </div>
                  </div>
                  {searchBar}
                </div>

                {gpsError && (
                  <div className="flex-shrink-0 mx-3 my-2 rounded-2xl px-4 py-3 text-sm font-black" style={{ backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.4)", color: "#DC2626" }}>
                    {gpsError}
                  </div>
                )}

                {/* Map container - scrollable area */}
                <div
                  className="flex-1 min-h-0"
                  style={{
                    position: "relative",
                    // Allow map to scroll when keyboard is open
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {mapPanel}
                </div>

                {/* Fixed bottom buttons - always visible */}
                <div
                  className="flex-shrink-0 p-3 flex flex-col gap-2"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderTop: "1px solid var(--border)",
                    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
                    position: "sticky",
                    bottom: 0,
                    zIndex: 100, // Above map
                  }}
                >
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="w-full rounded-2xl px-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{
                      minHeight: "52px",
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      touchAction: "manipulation",
                    }}
                  >
                    {locating ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                    <span>{locating ? "جاري تحديد موقعك..." : "📍 تحديد موقعي الحالي"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSelection}
                    disabled={!pendingSelection || geocoding || loading}
                    className="w-full rounded-2xl px-4 font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{
                      minHeight: "56px",
                      backgroundColor: "var(--brand)",
                      color: "var(--brand-fg)",
                      touchAction: "manipulation",
                    }}
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
              style={{ border: "2px solid var(--brand-border)", backgroundColor: "var(--brand-subtle)" }}
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
                ابحث بالعنوان أو حرّك الخريطة، ثم أكد الموقع للمتابعة
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
                    <>
                      {pendingSelection.district && pendingSelection.city && (
                        <p className="text-sm mt-1 font-bold" style={{ color: "var(--text-sub)" }}>
                          {pendingSelection.district}، {pendingSelection.city}
                        </p>
                      )}
                      <p className="text-xs mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                        {pendingSelection.lat.toFixed(6)}, {pendingSelection.lng.toFixed(6)}
                      </p>
                    </>
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
