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

  // Return google if already loaded and fully initialized
  if (isLoaded && window.google?.maps?.places) {
    return window.google;
  }

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    // Check if script already exists and is loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript && window.google?.maps?.places) {
      isLoaded = true;
      resolve(window.google);
      return;
    }

    // If script exists but not fully loaded, wait for it
    if (existingScript && !window.google?.maps) {
      console.log("[GoogleMaps] Script tag exists, waiting for initialization...");
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          isLoaded = true;
          resolve(window.google);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.maps) {
          loadPromise = null;
          reject(new Error("Timeout waiting for Google Maps to initialize"));
        }
      }, 10000);
      return;
    }

    // Create script element
    const script = document.createElement("script");
    const libraries = (options.libraries || ["places", "geocoding"]).join(",");
    const params = new URLSearchParams({
      key: options.apiKey,
      libraries,
      language: options.language || "ar",
      region: options.region || "SA",
      loading: "async",
      callback: "__googleMapsCallback",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;

    // Create global callback
    (window as any).__googleMapsCallback = () => {
      console.log("[GoogleMaps] API loaded successfully");

      // Verify all required components are loaded
      if (!window.google?.maps) {
        loadPromise = null;
        reject(new Error("Google Maps API loaded but google.maps is undefined"));
        return;
      }

      if (libraries.includes("places") && !window.google.maps.places) {
        loadPromise = null;
        reject(new Error("Google Maps Places library failed to load"));
        return;
      }

      isLoaded = true;
      resolve(window.google);

      // Clean up callback
      delete (window as any).__googleMapsCallback;
    };

    script.onerror = (error) => {
      console.error("[GoogleMaps] Script load error:", error);
      loadPromise = null;
      delete (window as any).__googleMapsCallback;
      reject(new Error(`Failed to load Google Maps script: ${error}`));
    };

    // Add timeout for the entire load process
    const timeoutId = setTimeout(() => {
      if (!isLoaded) {
        console.error("[GoogleMaps] Load timeout");
        loadPromise = null;
        delete (window as any).__googleMapsCallback;
        reject(new Error("Google Maps API load timeout after 15 seconds"));
      }
    }, 15000);

    // Clear timeout when loaded
    const originalCallback = (window as any).__googleMapsCallback;
    (window as any).__googleMapsCallback = () => {
      clearTimeout(timeoutId);
      originalCallback();
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if Google Maps API is loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return isLoaded && Boolean(window.google?.maps?.places);
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
