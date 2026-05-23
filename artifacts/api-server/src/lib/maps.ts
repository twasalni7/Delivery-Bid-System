import { logger } from "./logger";
import { haversineKm } from "@workspace/db/utils/pricing";

// Verified against the OpenRouteService v2 directions API on 2026-05-10.
const DEFAULT_ORS_API_URL = "https://api.openrouteservice.org/v2";
const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_LANGUAGE = "ar"; // Arabic language for better local results
const ROUTE_LANGUAGE = "en"; // OpenRouteService doesn't support 'ar' for directions, using 'en' for route calculations
const GEO_CACHE_LIMIT = 500; // Increased cache size for better performance
const geoCache = new Map<string, unknown>();
const FALLBACK_AVG_SPEED_KPH = 40;
const ORS_DEFAULT_RADIUS_M = 350;
const ORS_RETRY_RADIUS_M = 2000;

// Cache for search queries with TTL
const searchCacheWithTTL = new Map<string, { data: unknown; timestamp: number }>();
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache TTL

// Popular Saudi cities and neighborhoods for enhanced search
const POPULAR_LOCATIONS = [
  { name: "الدمام", lat: 26.4207, lng: 50.0888, type: "city" },
  { name: "الخبر", lat: 26.2172, lng: 50.1971, type: "city" },
  { name: "الظهران", lat: 26.2724, lng: 50.1514, type: "city" },
  { name: "القطيف", lat: 26.5651, lng: 50.0088, type: "city" },
  { name: "الجبيل", lat: 27.0047, lng: 49.6255, type: "city" },
  { name: "الأحساء", lat: 25.3787, lng: 49.5857, type: "city" },
  { name: "الرياض", lat: 24.7136, lng: 46.6753, type: "city" },
  { name: "جدة", lat: 21.4858, lng: 39.1925, type: "city" },
  { name: "مكة", lat: 21.4225, lng: 39.8262, type: "city" },
  { name: "المدينة المنورة", lat: 24.5247, lng: 39.5692, type: "city" },
];

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

function isNoRoutablePointError(body: unknown): boolean {
  const errorObj = (body as { error?: unknown } | null)?.error;
  const code = (errorObj as { code?: number } | null)?.code;
  if (code === 2010) return true;

  const message = String((errorObj as { message?: unknown } | null)?.message ?? "");
  return message.toLowerCase().includes("could not find routable point");
}

function buildFallbackRoutePlan(points: RoutePoint[], reason: string): RoutePlan {
  const distanceKm = points.slice(1).reduce((sum, point, idx) => {
    const prev = points[idx]!;
    return sum + haversineKm(prev.lat, prev.lng, point.lat, point.lng);
  }, 0);
  const durationMinutes = distanceKm > 0 ? (distanceKm / FALLBACK_AVG_SPEED_KPH) * 60 : 0;

  logger.warn(
    { reason, distanceKm, pointsCount: points.length },
    "maps: using fallback haversine route (no provider polyline)"
  );

  return {
    distanceKm,
    durationMinutes,
    routePolyline: "",
    coordinates: {
      pickup: points[0] ?? null,
      dropoff: points[points.length - 1] ?? null,
      waypoints: points.slice(1, -1),
    },
  };
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

function getCachedWithTTL<T>(key: string): T | null {
  const cached = searchCacheWithTTL.get(key);
  if (!cached) return null;

  // Check if cache has expired
  if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL_MS) {
    searchCacheWithTTL.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCachedWithTTL<T>(key: string, value: T): T {
  // Clean up expired entries if cache is getting large
  if (searchCacheWithTTL.size >= GEO_CACHE_LIMIT) {
    const now = Date.now();
    for (const [k, v] of searchCacheWithTTL.entries()) {
      if (now - v.timestamp > SEARCH_CACHE_TTL_MS) {
        searchCacheWithTTL.delete(k);
      }
    }

    // If still too large, remove oldest entries
    if (searchCacheWithTTL.size >= GEO_CACHE_LIMIT) {
      const oldestKey = searchCacheWithTTL.keys().next().value;
      if (oldestKey) searchCacheWithTTL.delete(oldestKey);
    }
  }

  searchCacheWithTTL.set(key, { data: value, timestamp: Date.now() });
  return value;
}

function getNominatimUrl(path: string) {
  return `${(process.env["NOMINATIM_API_URL"] ?? DEFAULT_NOMINATIM_URL).replace(/\/+$/, "")}${path}`;
}

export async function searchPlaces(query: string, limit = 6, options?: { viewbox?: string; bounded?: boolean }) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `search:${trimmed}:${limit}:${options?.viewbox ?? ''}:${options?.bounded ?? ''}`;
  const cached = getCachedWithTTL<unknown[]>(cacheKey);
  if (cached) return cached;

  // Check for popular location matches first for instant results
  const lowerQuery = trimmed.toLowerCase();
  const popularMatches = POPULAR_LOCATIONS.filter(loc =>
    loc.name.includes(trimmed) || loc.name.toLowerCase().includes(lowerQuery)
  ).slice(0, 3); // Take top 3 popular matches

  const url = new URL(getNominatimUrl("/search"));
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("accept-language", DEFAULT_LANGUAGE);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "sa"); // Limit search to Saudi Arabia for better accuracy
  url.searchParams.set("dedupe", "1"); // Remove duplicate results

  // Add viewbox for better regional results
  if (options?.viewbox) {
    url.searchParams.set("viewbox", options.viewbox);
    if (options.bounded) {
      url.searchParams.set("bounded", "1");
    }
  }

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

  // Process and enhance results
  const results = data.map((item) => {
    const address = String(item["display_name"] ?? "").trim();
    const addressObj = item["address"] as Record<string, unknown> | undefined;

    // Extract key address components for better display
    const neighbourhood = addressObj?.neighbourhood || addressObj?.suburb || addressObj?.quarter;
    const city = addressObj?.city || addressObj?.town || addressObj?.village;
    const district = addressObj?.district || addressObj?.state_district;

    // Create a more readable short address if possible
    let shortAddress = address;
    if (neighbourhood && city) {
      shortAddress = `${neighbourhood}، ${city}`;
    } else if (city) {
      shortAddress = String(city);
    }

    return {
      id: item["place_id"],
      address,
      shortAddress,
      lat: Number(item["lat"]),
      lng: Number(item["lon"]),
      type: String(item["type"] ?? ""),
      importance: Number(item["importance"] ?? 0),
    };
  });

  // Add popular matches to the beginning if they exist
  if (popularMatches.length > 0) {
    const popularResults = popularMatches.map((loc, idx) => ({
      id: `popular-${idx}`,
      address: `${loc.name}، المملكة العربية السعودية`,
      shortAddress: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      type: loc.type,
      importance: 1.0, // High importance for popular locations
    }));

    // Merge popular results with search results, removing duplicates
    const merged = [...popularResults];
    for (const result of results) {
      const isDuplicate = popularResults.some(pr =>
        Math.abs(pr.lat - result.lat) < 0.01 && Math.abs(pr.lng - result.lng) < 0.01
      );
      if (!isDuplicate) {
        merged.push({
          ...result,
          id: String(result.id),
        });
      }
    }

    // Sort by importance and limit
    merged.sort((a, b) => b.importance - a.importance);
    return setCachedWithTTL(cacheKey, merged.slice(0, limit));
  }

  // Sort by importance to show most relevant results first
  results.sort((a, b) => b.importance - a.importance);

  // Convert ids to strings for consistency
  const normalizedResults = results.map(r => ({
    ...r,
    id: String(r.id),
  }));

  return setCachedWithTTL(cacheKey, normalizedResults);
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
    return buildFallbackRoutePlan(points, "openrouteservice_not_configured");
  }

  try {
    const fetchRoute = async (radiusMeters?: number) => {
      const response = await fetch(`${config.apiUrl}/directions/driving-car/json`, {
        method: "POST",
        headers: {
          Authorization: config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: points.map((point) => [point.lng, point.lat]),
          instructions: false,
          language: ROUTE_LANGUAGE,
          geometry: true,
          ...(radiusMeters != null ? { radiuses: points.map(() => radiusMeters) } : {}),
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            error?: unknown;
            routes?: Array<{
              geometry?: string;
              summary?: { distance?: number; duration?: number };
            }>;
          }
        | null;

      return { response, body };
    };

    const first = await fetchRoute();

    if (!first.response.ok) {
      // ORS rejects coordinates that are slightly off-road (default snap radius is 350m).
      // Retry once with a larger radius before falling back.
      if (first.response.status === 404 && isNoRoutablePointError(first.body)) {
        logger.warn(
          {
            status: first.response.status,
            body: first.body,
            defaultRadiusMeters: ORS_DEFAULT_RADIUS_M,
            retryRadiusMeters: ORS_RETRY_RADIUS_M,
          },
          "maps: no routable point within default radius; retrying with larger radius"
        );

        const retry = await fetchRoute(ORS_RETRY_RADIUS_M);
        if (retry.response.ok) {
          const route = retry.body?.routes?.[0];
          if (route?.summary && route.geometry) {
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
          logger.error({ body: retry.body }, "maps: retry response missing summary/geometry");
        } else {
          logger.error({ status: retry.response.status, body: retry.body }, "maps: retry directions request failed");
        }

        return buildFallbackRoutePlan(points, "openrouteservice_no_routable_point");
      }

      logger.error({ status: first.response.status, body: first.body }, "maps: directions request failed");
      return buildFallbackRoutePlan(points, "openrouteservice_http_error");
    }

    const route = first.body?.routes?.[0];
    if (!route?.summary || !route.geometry) {
      logger.error({ body: first.body }, "maps: directions response missing summary/geometry");
      return buildFallbackRoutePlan(points, "openrouteservice_invalid_response");
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
  } catch (err) {
    logger.error({ err }, "maps: directions request threw");
    return buildFallbackRoutePlan(points, "openrouteservice_fetch_failed");
  }
}
