/**
 * Distance-based pricing utilities for delivery requests
 * نظام توصّلني — حساب الأسعار بناءً على المسافة
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

/** Default distance tiers (monthly, SAR) */
export const DEFAULT_DISTANCE_TIERS: PricingTier[] = [
  { max: 5,  base: 500 },
  { max: 10, base: 800 },
  { max: 15, base: 1000 },
  { max: 20, base: 1200 },
  { max: 25, base: 1400 },
  { max: 30, base: 1700 },
  { max: 40, base: 2200 },
];

/** Default per-person sharing discounts */
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

/**
 * Returns the sharing discount factor for a given number of sharing people.
 * Uses the closest lower-or-equal entry; falls back to the last entry for
 * counts larger than any configured value.
 */
export function getSharingFactor(
  numberOfPeople: number,
  discounts: SharingDiscount[]
): number {
  const sorted = [...discounts].sort((a, b) => a.people - b.people);
  let factor = sorted[0]?.factor ?? 1.0;
  for (const d of sorted) {
    if (numberOfPeople >= d.people) factor = d.factor;
  }
  return factor;
}

export interface PricingResult {
  /** Total monthly price for this subscription in SAR */
  price: number;
  /** Per-person monthly price in SAR */
  pricePerPerson: number;
  /** Whether distance exceeds 40km and requires admin review */
  needsAdminReview: boolean;
  /** Base tier price before multipliers */
  baseTier: number | null;
  /** Trip type multiplier (1.0 or 1.7) */
  tripMultiplier: number;
  /** Days per week multiplier (1.0, 1.15, or 1.25) */
  daysMultiplier: number;
  /**
   * Per-person sharing discount factor (1.0, 0.72, 0.60, 0.52).
   * Replaces the old `peopleMultiplier`.
   */
  shareDiscountFactor: number;
  /** Number of people used for calculation */
  numberOfPeople: number;
}

/**
 * Calculate monthly subscription price based on distance and parameters.
 * Returns needsAdminReview=true when distance > 40 km.
 *
 * Price formula:
 *   pricePerPerson = baseTier × tripMultiplier × daysMultiplier × shareDiscountFactor
 *   price (total)  = pricePerPerson × numberOfPeople
 *
 * @param distanceKm Distance in kilometers
 * @param tripType One-way or round trip
 * @param daysPerWeek Working days per week
 * @param numberOfPeople Number of passengers sharing this subscription
 * @param config Optional pricing config — uses system defaults when omitted
 * @returns PricingResult with calculated price and metadata
 */
export function calculateMonthlyPrice(
  distanceKm: number,
  tripType: TripType,
  daysPerWeek: number,
  numberOfPeople: number,
  config?: Partial<PricingConfig>
): PricingResult {
  const tiers = config?.tiers ?? DEFAULT_DISTANCE_TIERS;
  const sharingDiscounts = config?.sharingDiscounts ?? DEFAULT_SHARING_DISCOUNTS;

  // Distance exceeds threshold — requires admin review
  if (distanceKm > ADMIN_REVIEW_DISTANCE_KM) {
    return {
      price: 0,
      pricePerPerson: 0,
      needsAdminReview: true,
      baseTier: null,
      tripMultiplier: 0,
      daysMultiplier: 0,
      shareDiscountFactor: 0,
      numberOfPeople,
    };
  }

  // Find appropriate tier based on distance (sorted ascending by max)
  const sortedTiers = [...tiers].sort((a, b) => a.max - b.max);
  const tier = sortedTiers.find((t) => distanceKm <= t.max);

  // Defensive: no tier found (config gap) — require admin review
  if (!tier) {
    return {
      price: 0,
      pricePerPerson: 0,
      needsAdminReview: true,
      baseTier: null,
      tripMultiplier: 0,
      daysMultiplier: 0,
      shareDiscountFactor: 0,
      numberOfPeople,
    };
  }

  // Multipliers
  const tripMultiplier = tripType === "round_trip" ? 1.7 : 1.0;
  const daysMultiplier = daysPerWeek >= 7 ? 1.25 : daysPerWeek >= 6 ? 1.15 : 1.0;
  const shareDiscountFactor = getSharingFactor(numberOfPeople, sharingDiscounts);

  // Per-person price
  const pricePerPerson = Math.round(
    tier.base * tripMultiplier * daysMultiplier * shareDiscountFactor
  );

  // Total price for all people in this subscription
  const price = pricePerPerson * numberOfPeople;

  return {
    price,
    pricePerPerson,
    needsAdminReview: false,
    baseTier: tier.base,
    tripMultiplier,
    daysMultiplier,
    shareDiscountFactor,
    numberOfPeople,
  };
}
