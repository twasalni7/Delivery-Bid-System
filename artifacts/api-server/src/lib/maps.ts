import { logger } from "./logger";
import { haversineKm } from "@workspace/db/utils/pricing";

// Verified against the OpenRouteService v2 directions API on 2026-05-10.
const DEFAULT_ORS_API_URL = "https://api.openrouteservice.org/v2";
const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_LANGUAGE = "en"; // OpenRouteService doesn't support 'ar' for directions, causing HTTP 500
const GEO_CACHE_LIMIT = 200;
const geoCache = new Map<string, unknown>();
const FALLBACK_AVG_SPEED_KPH = 40;
const ORS_DEFAULT_RADIUS_M = 350;
const ORS_RETRY_RADIUS_M = 2000;

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
          language: DEFAULT_LANGUAGE,
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
