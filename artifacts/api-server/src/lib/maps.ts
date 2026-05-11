import { logger } from "./logger";

// Verified against the OpenRouteService v2 directions API on 2026-05-10.
const DEFAULT_ORS_API_URL = "https://api.openrouteservice.org/v2";
const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_LANGUAGE = "en"; // OpenRouteService doesn't support 'ar' for directions, causing HTTP 500
const GEO_CACHE_LIMIT = 200;
const geoCache = new Map<string, unknown>();

export type RoutePoint = {
  lat: number;
  lng: number;
  address?: string | null;
  type?: string | null;
};

export type RoutePlan = {
  distanceKm: number;
  durationMinutes: number;
  routePolyline: string;
  coordinates: {
    pickup: RoutePoint | null;
    dropoff: RoutePoint | null;
    waypoints: RoutePoint[];
  };
};

export function getOpenRouteServiceConfig() {
  const apiKey = process.env["OPENROUTESERVICE_API_KEY"]?.trim();
  const apiUrl = (process.env["OPENROUTESERVICE_API_URL"] ?? DEFAULT_ORS_API_URL).replace(/\/+$/, "");
  if (!apiKey) return null;
  return { apiKey, apiUrl };
}

export function isOpenRouteServiceConfigured(): boolean {
  return Boolean(getOpenRouteServiceConfig());
}

function getCached<T>(key: string): T | null {
  return (geoCache.get(key) as T | undefined) ?? null;
}

function setCached<T>(key: string, value: T): T {
  if (!geoCache.has(key) && geoCache.size >= GEO_CACHE_LIMIT) {
    const oldestKey = geoCache.keys().next().value;
    if (oldestKey) geoCache.delete(oldestKey);
  }
  geoCache.set(key, value);
  return value;
}

function getNominatimUrl(path: string) {
  return `${(process.env["NOMINATIM_API_URL"] ?? DEFAULT_NOMINATIM_URL).replace(/\/+$/, "")}${path}`;
}

export async function searchPlaces(query: string, limit = 6) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const cacheKey = `search:${trimmed}:${limit}`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(getNominatimUrl("/search"));
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("accept-language", DEFAULT_LANGUAGE);
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "Accept-Language": DEFAULT_LANGUAGE,
      "User-Agent": "Twasalni Delivery Bid System/1.0",
    },
  });
  if (!response.ok) {
    throw new Error("failed_to_search_places");
  }

  const data = (await response.json()) as Array<Record<string, unknown>>;
  return setCached(
    cacheKey,
    data.map((item) => ({
      id: item["place_id"],
      address: String(item["display_name"] ?? "").trim(),
      lat: Number(item["lat"]),
      lng: Number(item["lon"]),
    }))
  );
}

export async function reverseGeocode(lat: number, lng: number) {
  const cacheKey = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const url = new URL(getNominatimUrl("/reverse"));
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", DEFAULT_LANGUAGE);
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "Accept-Language": DEFAULT_LANGUAGE,
      "User-Agent": "Twasalni Delivery Bid System/1.0",
    },
  });
  if (!response.ok) {
    throw new Error("failed_to_reverse_geocode");
  }

  const data = (await response.json()) as { display_name?: string };
  const address = data.display_name?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return setCached(cacheKey, address);
}

export async function calculateRoutePlan(points: RoutePoint[]): Promise<RoutePlan> {
  if (points.length < 2) {
    throw new Error("route_requires_at_least_two_points");
  }

  const config = getOpenRouteServiceConfig();
  if (!config) {
    throw new Error("openrouteservice_not_configured");
  }

  const response = await fetch(`${config.apiUrl}/directions/driving-car/json`, {
    method: "POST",
    headers: {
      Authorization: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: points.map((point) => [point.lng, point.lat]),
      instructions: false,
      language: DEFAULT_LANGUAGE,
      geometry: true,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | {
        error?: string;
        routes?: Array<{
          geometry?: string;
          summary?: { distance?: number; duration?: number };
        }>;
      }
    | null;

  if (!response.ok) {
    logger.error({ status: response.status, body }, "maps: directions request failed");
    throw new Error("route_calculation_failed");
  }

  const route = body?.routes?.[0];
  if (!route?.summary || !route.geometry) {
    throw new Error("route_response_missing_summary");
  }

  return {
    distanceKm: Number(route.summary.distance ?? 0) / 1000,
    durationMinutes: Number(route.summary.duration ?? 0) / 60,
    routePolyline: route.geometry,
    coordinates: {
      pickup: points[0] ?? null,
      dropoff: points[points.length - 1] ?? null,
      waypoints: points.slice(1, -1),
    },
  };
}
