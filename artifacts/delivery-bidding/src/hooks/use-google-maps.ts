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
  const [isLoaded, setIsLoaded] = useState(() => isGoogleMapsLoaded());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [googleInstance, setGoogleInstance] = useState<typeof window.google | null>(
    () => (isGoogleMapsLoaded() ? window.google : null)
  );
  const loadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!enabled) return;
    if (isLoaded && googleInstance) return;
    if (loadingRef.current) return;

    // Check if already loaded externally
    if (isGoogleMapsLoaded() && window.google?.maps) {
      setIsLoaded(true);
      setGoogleInstance(window.google);
      setError(null);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    const attemptLoad = async () => {
      try {
        const apiKey = await fetchGoogleMapsApiKey();

        if (!apiKey) {
          throw new Error("Google Maps API key is not configured");
        }

        const google = await loadGoogleMapsAPI({
          apiKey,
          libraries: ["places", "geocoding", "geometry"],
          language: "ar",
          region: "SA",
        });

        // Double-check that google.maps is actually available
        if (!google?.maps) {
          throw new Error("Google Maps API loaded but google.maps is not available");
        }

        // Verify that Places API is available
        if (!google.maps.places) {
          throw new Error("Google Maps Places library is not available");
        }

        setIsLoaded(true);
        setGoogleInstance(google);
        setError(null);
        setIsLoading(false);
        // Also reset the ref so future enabled→false→true cycles can re-trigger if needed.
        loadingRef.current = false;
        retryCountRef.current = 0;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        console.error(`Failed to load Google Maps (attempt ${retryCountRef.current + 1}/${maxRetries}):`, errorMessage);

        // Retry logic
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000); // Exponential backoff: 1s, 2s, 4s
          console.log(`Retrying Google Maps load in ${retryDelay}ms...`);

          setTimeout(() => {
            loadingRef.current = false;
            attemptLoad();
          }, retryDelay);
          return;
        }

        // Max retries reached
        setError(errorMessage);
        setIsLoading(false);
        loadingRef.current = false;
      }
    };

    attemptLoad();
  }, [enabled, isLoaded, googleInstance, error]);

  return {
    isLoaded,
    isLoading,
    error,
    google: googleInstance,
  };
}
