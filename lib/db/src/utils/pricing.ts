/**
 * Distance-based pricing utilities for delivery requests
 * نظام توصّلني — أدوات مساعدة للتسعير
 */

/** A single distance-based pricing tier */
export interface PricingTier {
  /** Upper bound of this tier in km */
  max: number;
  /** Base monthly price in SAR for this tier */
  base: number;
}

/** Sharing discount entry: per-person factor when `people` riders share */
export interface SharingDiscount {
  people: number;
  /** Factor applied to base price per person (e.g. 0.72 = 72%) */
  factor: number;
}

/** Full pricing configuration — can be overridden from DB (app_config) */
export interface PricingConfig {
  tiers: PricingTier[];
  sharingDiscounts: SharingDiscount[];
  /** Max distance (km) between two homes to qualify for shared subscription */
  proximityHomeKm: number;
  /** Max distance (km) between two workplaces to qualify for shared subscription */
  proximityWorkKm: number;
  /** Max difference (minutes) between shift times to qualify for shared subscription */
  proximityTimeMinutes: number;
}

/** Default distance tiers (monthly, SAR) — used as fallback if app_config is missing */
export const DEFAULT_DISTANCE_TIERS: PricingTier[] = [
  { max: 5,  base: 500 },
  { max: 10, base: 800 },
  { max: 15, base: 1000 },
  { max: 20, base: 1200 },
  { max: 25, base: 1400 },
  { max: 30, base: 1700 },
  { max: 40, base: 2200 },
];

/** Default per-person sharing discounts — used as fallback if app_config is missing */
export const DEFAULT_SHARING_DISCOUNTS: SharingDiscount[] = [
  { people: 1, factor: 1.00 },
  { people: 2, factor: 0.72 },
  { people: 3, factor: 0.60 },
  { people: 4, factor: 0.52 },
];

export const DEFAULT_PROXIMITY_HOME_KM = 2;
export const DEFAULT_PROXIMITY_WORK_KM = 2;
export const DEFAULT_PROXIMITY_TIME_MINUTES = 30;

/** Returns a default PricingConfig with all values set to system defaults */
export function getDefaultPricingConfig(): PricingConfig {
  return {
    tiers: DEFAULT_DISTANCE_TIERS,
    sharingDiscounts: DEFAULT_SHARING_DISCOUNTS,
    proximityHomeKm: DEFAULT_PROXIMITY_HOME_KM,
    proximityWorkKm: DEFAULT_PROXIMITY_WORK_KM,
    proximityTimeMinutes: DEFAULT_PROXIMITY_TIME_MINUTES,
  };
}

/** Requests exceeding this distance (km) require admin review before drivers can see them */
export const ADMIN_REVIEW_DISTANCE_KM = 40;

/**
 * Calculate Haversine straight-line distance between two coordinates
 * @param lat1 Latitude of first point (degrees)
 * @param lng1 Longitude of first point (degrees)
 * @param lat2 Latitude of second point (degrees)
 * @param lng2 Longitude of second point (degrees)
 * @returns Distance in kilometers
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
