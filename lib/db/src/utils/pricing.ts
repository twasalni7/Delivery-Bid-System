/**
 * Distance-based pricing utilities for delivery requests
 * نظام توصّلني — حساب الأسعار بناءً على المسافة
 */

/** Distance-based pricing tiers (monthly, SAR) */
const DISTANCE_TIERS = [
  { max: 5,  base: 400 },
  { max: 10, base: 650 },
  { max: 20, base: 950 },
  { max: 30, base: 1300 },
  { max: 40, base: 1700 },
] as const;

/** Requests exceeding this distance (km) require admin review before drivers can see them */
export const ADMIN_REVIEW_DISTANCE_KM = 40;

export type TripType = "one_way" | "round_trip";

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

export interface PricingResult {
  /** Calculated monthly price in SAR */
  price: number;
  /** Whether distance exceeds 40km and requires admin review */
  needsAdminReview: boolean;
  /** Base tier price before multipliers */
  baseTier: number | null;
  /** Trip type multiplier (1.0 or 1.7) */
  tripMultiplier: number;
  /** Days per week multiplier (1.0, 1.15, or 1.25) */
  daysMultiplier: number;
  /** Number of people multiplier (1.0, 1.6, or 2.1) */
  peopleMultiplier: number;
}

/**
 * Calculate monthly subscription price based on distance and parameters
 * Returns needsAdminReview=true when distance > 40 km
 * 
 * @param distanceKm Distance in kilometers
 * @param tripType One-way or round trip
 * @param daysPerWeek Working days per week
 * @param numberOfPeople Number of passengers
 * @returns PricingResult with calculated price and metadata
 */
export function calculateMonthlyPrice(
  distanceKm: number,
  tripType: TripType,
  daysPerWeek: number,
  numberOfPeople: number
): PricingResult {
  // Distance exceeds threshold - requires admin review
  if (distanceKm > ADMIN_REVIEW_DISTANCE_KM) {
    return {
      price: 0,
      needsAdminReview: true,
      baseTier: null,
      tripMultiplier: 0,
      daysMultiplier: 0,
      peopleMultiplier: 0,
    };
  }

  // Find appropriate tier based on distance
  const tier = DISTANCE_TIERS.find((t) => distanceKm <= t.max);
  // NOTE: This check is defensive programming. Given that distanceKm ≤ 40 here
  // (checked above) and our tiers cover 0-40km, this should never trigger.
  // However, it provides safety if tiers are modified in the future.
  if (!tier) {
    return {
      price: 0,
      needsAdminReview: true,
      baseTier: null,
      tripMultiplier: 0,
      daysMultiplier: 0,
      peopleMultiplier: 0,
    };
  }

  // Calculate multipliers
  const tripMultiplier = tripType === "round_trip" ? 1.7 : 1.0;
  const daysMultiplier = daysPerWeek >= 7 ? 1.25 : daysPerWeek >= 6 ? 1.15 : 1.0;
  const peopleMultiplier = numberOfPeople >= 3 ? 2.1 : numberOfPeople >= 2 ? 1.6 : 1.0;

  // Calculate final price
  const price = Math.round(
    tier.base * tripMultiplier * daysMultiplier * peopleMultiplier
  );

  return {
    price,
    needsAdminReview: false,
    baseTier: tier.base,
    tripMultiplier,
    daysMultiplier,
    peopleMultiplier,
  };
}
