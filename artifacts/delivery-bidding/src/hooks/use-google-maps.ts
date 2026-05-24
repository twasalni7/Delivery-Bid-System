/**
 * use-google-maps.ts — React hook for Google Maps API
 * Handles loading and initialization of Google Maps with error handling
 */

import { useState, useEffect, useRef } from "react";
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from "@/lib/google-maps-loader";

interface UseGoogleMapsOptions {
  enabled?: boolean;
}

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
  google: typeof window.google | null;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export function useGoogleMaps(options: UseGoogleMapsOptions = {}): UseGoogleMapsReturn {
  const { enabled = true } = options;
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [googleInstance, setGoogleInstance] = useState<typeof window.google | null>(
    isGoogleMapsLoaded() ? window.google : null
  );
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (isLoaded) return;
    if (loadingRef.current) return;

    if (!GOOGLE_MAPS_API_KEY) {
      setError(new Error("Google Maps API key is not configured"));
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    loadGoogleMapsAPI({
      apiKey: GOOGLE_MAPS_API_KEY,
      libraries: ["places", "geocoding", "geometry"],
      language: "ar",
      region: "SA",
    })
      .then((google) => {
        setIsLoaded(true);
        setGoogleInstance(google);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error("Failed to load Google Maps:", err);
      })
      .finally(() => {
        setIsLoading(false);
        loadingRef.current = false;
      });
  }, [enabled, isLoaded]);

  return {
    isLoaded,
    isLoading,
    error,
    google: googleInstance,
  };
}
