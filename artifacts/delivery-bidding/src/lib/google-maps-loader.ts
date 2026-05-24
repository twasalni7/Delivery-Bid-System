/**
 * google-maps-loader.ts — Google Maps API loader
 * Handles lazy loading of Google Maps JavaScript API with Places & Geocoding
 */

type GoogleMapsLibrary = "places" | "geocoding" | "geometry";

interface LoaderOptions {
  apiKey: string;
  libraries?: GoogleMapsLibrary[];
  language?: string;
  region?: string;
}

let loadPromise: Promise<typeof google> | null = null;
let isLoaded = false;

/**
 * Load Google Maps JavaScript API
 * Returns a promise that resolves when the API is ready
 */
export async function loadGoogleMapsAPI(options: LoaderOptions): Promise<typeof google> {
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }

  // Return google if already loaded
  if (isLoaded && window.google?.maps) {
    return window.google;
  }

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript && window.google?.maps) {
      isLoaded = true;
      resolve(window.google);
      return;
    }

    // Create script element
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: options.apiKey,
      libraries: (options.libraries || ["places", "geocoding"]).join(","),
      language: options.language || "ar",
      region: options.region || "SA",
      loading: "async",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        isLoaded = true;
        resolve(window.google);
      } else {
        reject(new Error("Google Maps API loaded but google.maps is undefined"));
      }
    };

    script.onerror = (error) => {
      loadPromise = null;
      reject(new Error(`Failed to load Google Maps API: ${error}`));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if Google Maps API is loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return isLoaded && Boolean(window.google?.maps);
}

/**
 * Get Google Maps API instance (must be loaded first)
 */
export function getGoogleMaps(): typeof google {
  if (!window.google?.maps) {
    throw new Error("Google Maps API not loaded. Call loadGoogleMapsAPI first.");
  }
  return window.google;
}

/**
 * Reset loader state (for testing)
 */
export function resetLoader() {
  loadPromise = null;
  isLoaded = false;
}
