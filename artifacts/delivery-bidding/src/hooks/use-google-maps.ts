/**
 * use-google-maps.ts — React hook for Google Maps API
 * Handles loading and initialization of Google Maps with error handling
 */

import { useState, useEffect, useRef } from "react";
import { loadGoogleMapsAPI, isGoogleMapsLoaded } from "@/lib/google-maps-loader";
import { API_ORIGIN } from "@/lib/api-config";

interface UseGoogleMapsOptions {
  enabled?: boolean;
}

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
  google: typeof window.google | null;
}

/**
 * Fetch Google Maps API key from server
 */
async function fetchGoogleMapsApiKey(): Promise<string | null> {
  try {
    // First try to use the environment variable (for local development)
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) return envKey;

    // Otherwise fetch from server
    const res = await fetch(`${API_ORIGIN}/api/push/google-maps-key`);
    if (!res.ok) return null;
    const body = (await res.json()) as { apiKey?: string };
    return body.apiKey ?? null;
  } catch (err) {
    console.warn("[GoogleMaps] Failed to fetch API key:", err);
    return null;
  }
}

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

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    (async () => {
      const apiKey = await fetchGoogleMapsApiKey();

      if (!apiKey) {
        setError(new Error("Google Maps API key is not configured"));
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      loadGoogleMapsAPI({
        apiKey,
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
    })();
  }, [enabled, isLoaded]);

  return {
    isLoaded,
    isLoading,
    error,
    google: googleInstance,
  };
}
