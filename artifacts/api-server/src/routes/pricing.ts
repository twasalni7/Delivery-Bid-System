import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable, requestsTable, pricingMatrixTable } from "@workspace/db";
import {
  haversineKm,
  getDefaultPricingConfig,
  type PricingConfig,
  type PricingTier,
  type SharingDiscount,
  ADMIN_REVIEW_DISTANCE_KM,
} from "@workspace/db/utils/pricing";
import { eq, and, lte, gt, gte } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";
const DEFAULT_PRICING_ENGINE = "formula_v2" as const;
const BASE_LOCATION_COUNT = 1;
// Business rule: each extra passenger adds 50% to the base total (shared trips).
const EXTRA_PASSENGER_FACTOR_INCREMENT = 0.5;

type AppConfigMap = Record<string, string>;

interface FormulaV2Constants {
  pricePerKm: number;
  visitFee: number;
  extraLocationRate: number;
  weeks: number;
}

const DEFAULT_FORMULA_V2_CONSTANTS: FormulaV2Constants = {
  pricePerKm: 0.85,
  visitFee: 15,
  extraLocationRate: 0.15,
  weeks: 4,
};

export type PricingEngine = "matrix" | "formula_v2";

export interface UnifiedPricingInput {
  distance: number;
  daysPerWeek: number;
  type: string | number;
  persons: number;
  locations: number;
}

// ─── Helper: load pricing config from DB ──────────────────────────────────────

async function loadAppConfigMap(): Promise<AppConfigMap> {
  try {
    const rows = await db.select().from(appConfigTable);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    logger.error({ err }, "loadAppConfigMap: DB read failed, using empty config");
    return {};
  }
}

function parseStrictPositiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(raw ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  logger.warn({ raw }, "Invalid boolean app_config value, using fallback");
  return fallback;
}

async function loadPricingRuntimeConfig(): Promise<{
  engine: PricingEngine;
  shadowCompare: boolean;
  formulaConstants: FormulaV2Constants;
}> {
  const map = await loadAppConfigMap();
  const engine = resolvePricingEngine(map["pricing_engine"]);
  const shadowCompare = parseBoolean(map["pricing_shadow_compare"], false);
  const formulaConstants: FormulaV2Constants = {
    pricePerKm: parseStrictPositiveNumber(map["pricing_v2_price_per_km"], DEFAULT_FORMULA_V2_CONSTANTS.pricePerKm),
    visitFee: parseStrictPositiveNumber(map["pricing_v2_visit_fee"], DEFAULT_FORMULA_V2_CONSTANTS.visitFee),
    extraLocationRate: parseStrictPositiveNumber(
      map["pricing_v2_extra_location_rate"],
      DEFAULT_FORMULA_V2_CONSTANTS.extraLocationRate
    ),
    weeks: parseStrictPositiveNumber(map["pricing_v2_weeks"], DEFAULT_FORMULA_V2_CONSTANTS.weeks),
  };
  return { engine, shadowCompare, formulaConstants };
}

export function resolvePricingEngine(raw: string | undefined | null): PricingEngine {
  if (raw === "formula_v2") return "formula_v2";
  if (raw === "matrix") return "matrix";
  return DEFAULT_PRICING_ENGINE;
}

export async function loadPricingConfig(): Promise<PricingConfig> {
  try {
    const map = await loadAppConfigMap();
    const def = getDefaultPricingConfig();

    let tiers: PricingTier[] = def.tiers;
    if (map["pricing_tiers"]) {
      try { tiers = JSON.parse(map["pricing_tiers"]); } catch { /* use default */ }
    }

    let sharingDiscounts: SharingDiscount[] = def.sharingDiscounts;
    if (map["sharing_discounts"]) {
      try { sharingDiscounts = JSON.parse(map["sharing_discounts"]); } catch { /* use default */ }
    }

    return {
      tiers,
      sharingDiscounts,
      proximityHomeKm: parseFloat(map["proximity_home_km"] ?? String(def.proximityHomeKm)) || def.proximityHomeKm,
      proximityWorkKm: parseFloat(map["proximity_work_km"] ?? String(def.proximityWorkKm)) || def.proximityWorkKm,
      proximityTimeMinutes: parseFloat(map["proximity_time_minutes"] ?? String(def.proximityTimeMinutes)) || def.proximityTimeMinutes,
    };
  } catch (err) {
    logger.error({ err }, "loadPricingConfig: DB read failed, using defaults");
    return getDefaultPricingConfig();
  }
}

const DEFAULT_BID_FEE = 50;

/** Reads the bid fee from app_config table. Returns DEFAULT_BID_FEE on any error. */
export async function getBidFee(): Promise<number> {
  try {
    const row = await db.query.appConfigTable.findFirst({
      where: eq(appConfigTable.key, "bid_fee"),
    });
    if (!row) return DEFAULT_BID_FEE;
    const val = parseFloat(row.value);
    return isNaN(val) || val <= 0 ? DEFAULT_BID_FEE : val;
  } catch (err) {
    logger.error({ err }, "getBidFee: DB read failed, using default");
    return DEFAULT_BID_FEE;
  }
}

// ─── Helper: query price_per_person from pricing_matrix ───────────────────────

export interface MatrixPricingResult {
  pricePerPerson: number;
  price: number;
  needsAdminReview: boolean;
  distanceKm: number;
  numberOfPeople: number;
}

export interface FormulaV2Result {
  totalPrice: number;
  pricePerPerson: number;
  details: {
    monthlyKm: number;
    monthlyTrips: number;
    baseCost: number;
  };
}

export function resolveTripsPerDay(type: string | number): number {
  if (type === "one_way") return 1;
  if (type === "round_trip") return 2;
  if (type === "shift") return 4;

  const numericType = typeof type === "number" ? type : Number.parseInt(String(type), 10);
  if (Number.isFinite(numericType) && numericType > 0) {
    return Math.round(numericType);
  }
  return 1;
}

export function calculateSubscriptionPriceV2(
  input: UnifiedPricingInput,
  constants: FormulaV2Constants = DEFAULT_FORMULA_V2_CONSTANTS
): FormulaV2Result {
  const distance = Math.max(0, Number(input.distance) || 0);
  const daysPerWeek = Math.max(1, Math.round(Number(input.daysPerWeek) || 1));
  const persons = Math.max(1, Math.round(Number(input.persons) || 1));
  const locations = Math.max(1, Math.round(Number(input.locations) || 1));
  const tripsPerDay = resolveTripsPerDay(input.type);

  const totalKmMonthly = distance * tripsPerDay * daysPerWeek * constants.weeks;
  const transportCost = totalKmMonthly * constants.pricePerKm;
  const extraLocationsCount = Math.max(0, locations - 1);
  const locationExtraCharge = extraLocationsCount * (transportCost * constants.extraLocationRate);
  const totalTripsMonthly = tripsPerDay * daysPerWeek * constants.weeks;
  const laborCost = totalTripsMonthly * constants.visitFee;
  const baseTotal = transportCost + locationExtraCharge + laborCost;
  // Business formula: every extra rider adds 50% to base (driver income grows, per-person share drops).
  const sharedRidePricingFactor = 1 + (persons - 1) * EXTRA_PASSENGER_FACTOR_INCREMENT;
  const finalTotal = baseTotal * sharedRidePricingFactor;
  const pricePerPerson = finalTotal / persons;

  return {
    totalPrice: Math.round(finalTotal),
    pricePerPerson: Math.round(pricePerPerson),
    details: {
      monthlyKm: totalKmMonthly,
      monthlyTrips: totalTripsMonthly,
      baseCost: Math.round(baseTotal),
    },
  };
}

export function getTripTypeFromShifts(
  numberOfShifts?: number | null,
  shifts?: { goTime: string; returnTime?: string; label?: string }[] | null
): string | number {
  const shiftsCount = Array.isArray(shifts) ? shifts.length : 0;
  const count = shiftsCount > 0 ? shiftsCount : Math.max(1, Math.round(Number(numberOfShifts) || 1));
  if (count === 1) return "one_way";
  if (count === 2) return "round_trip";
  if (count === 4) return "shift";
  return count;
}

function toFormulaResult(distanceKm: number, persons: number, formula: FormulaV2Result): MatrixPricingResult {
  return {
    pricePerPerson: formula.pricePerPerson,
    price: formula.totalPrice,
    needsAdminReview: false,
    distanceKm,
    numberOfPeople: persons,
  };
}

export async function getPriceFromActiveEngine(input: UnifiedPricingInput): Promise<MatrixPricingResult> {
  const distanceKm = Math.max(0, Number(input.distance) || 0);
  const persons = Math.max(1, Math.round(Number(input.persons) || 1));
  const needsAdminReview = distanceKm > ADMIN_REVIEW_DISTANCE_KM;

  if (needsAdminReview) {
    logger.info(
      { engine: "none", distanceKm, persons, reason: "needs_admin_review" },
      "pricing: distance exceeds review threshold — skipping calculation"
    );
    return { pricePerPerson: 0, price: 0, needsAdminReview: true, distanceKm, numberOfPeople: persons };
  }

  const runtime = await loadPricingRuntimeConfig();
  const formulaResult = calculateSubscriptionPriceV2({ ...input, distance: distanceKm, persons }, runtime.formulaConstants);

  if (runtime.engine === "formula_v2") {
    logger.info(
      {
        engine: "formula_v2",
        distanceKm,
        persons,
        daysPerWeek: input.daysPerWeek,
        locations: input.locations,
        type: input.type,
        totalPrice: formulaResult.totalPrice,
        pricePerPerson: formulaResult.pricePerPerson,
        details: formulaResult.details,
      },
      "pricing: using formula_v2 (new engine)"
    );
    if (runtime.shadowCompare) {
      const matrix = await getPriceFromMatrix(distanceKm, persons);
      logger.info(
        {
          engine: runtime.engine,
          distanceKm,
          persons,
          formulaPrice: formulaResult.totalPrice,
          matrixPrice: matrix.price,
          diff: formulaResult.totalPrice - matrix.price,
        },
        "pricing shadow compare"
      );
    }
    return toFormulaResult(distanceKm, persons, formulaResult);
  }

  const matrix = await getPriceFromMatrix(distanceKm, persons);
  logger.info(
    {
      engine: "matrix",
      distanceKm,
      persons,
      price: matrix.price,
      pricePerPerson: matrix.pricePerPerson,
      needsAdminReview: matrix.needsAdminReview,
    },
    "pricing: using matrix (legacy engine)"
  );
  if (runtime.shadowCompare) {
    logger.info(
      {
        engine: runtime.engine,
        distanceKm,
        persons,
        matrixPrice: matrix.price,
        formulaPrice: formulaResult.totalPrice,
        diff: matrix.price - formulaResult.totalPrice,
      },
      "pricing shadow compare"
    );
  }
  return matrix;
}

export interface PriceForRequestInput {
  distanceKm: number;
  numberOfPeople?: number | null;
  workingDaysPerWeek?: number | null;
  numberOfShifts?: number | null;
  shifts?: { goTime: string; returnTime?: string; label?: string }[] | null;
  additionalLocations?: { type: "pickup" | "dropoff"; address: string }[] | null;
  locations?: number | null;
  type?: string | number | null;
}

export async function calculatePriceForRequest(input: PriceForRequestInput): Promise<MatrixPricingResult> {
  const daysPerWeek = Math.max(1, Math.round(Number(input.workingDaysPerWeek) || 5));
  const persons = Math.max(1, Math.round(Number(input.numberOfPeople) || 1));
  const type = input.type ?? getTripTypeFromShifts(input.numberOfShifts, input.shifts);
  const derivedLocations =
    BASE_LOCATION_COUNT + (Array.isArray(input.additionalLocations) ? input.additionalLocations.length : 0);
  const explicitLocations = Number(input.locations);
  // If caller sends explicit `locations`, it has priority; otherwise derive from request additional stops.
  const locations =
    Number.isFinite(explicitLocations) && explicitLocations >= BASE_LOCATION_COUNT
      ? Math.round(explicitLocations)
      : derivedLocations;

  return getPriceFromActiveEngine({
    distance: input.distanceKm,
    daysPerWeek,
    type,
    persons,
    locations,
  });
}

export async function getPriceFromMatrix(
  distanceKm: number,
  numPassengers: number,
): Promise<MatrixPricingResult> {
  const needsAdminReview = distanceKm > ADMIN_REVIEW_DISTANCE_KM;
  if (needsAdminReview) {
    return { pricePerPerson: 0, price: 0, needsAdminReview: true, distanceKm, numberOfPeople: numPassengers };
  }

  const passengers = Math.max(1, Math.round(numPassengers));

  // First: try to find a specific row for this passenger count range
  const specificRows = await db
    .select()
    .from(pricingMatrixTable)
    .where(
      and(
        lte(pricingMatrixTable.distanceMinKm, distanceKm),
        gt(pricingMatrixTable.distanceMaxKm, distanceKm),
        lte(pricingMatrixTable.passengersMin, passengers),
        gte(pricingMatrixTable.passengersMax ?? 4, passengers),
      )
    )
    .limit(1);

  if (specificRows.length > 0) {
    const row = specificRows[0]!;
    const priceSar = row.priceSar ?? row.pricePerPerson;
    if (priceSar != null && priceSar > 0) {
      return {
        pricePerPerson: priceSar / passengers,
        price: priceSar,
        needsAdminReview: false,
        distanceKm,
        numberOfPeople: passengers,
      };
    }
  }

  // Fallback: get base row (passengersMin=1) and divide by passenger count
  const baseRows = await db
    .select({
      priceSar: pricingMatrixTable.priceSar,
      passengersMax: pricingMatrixTable.passengersMax,
      pricePerPerson: pricingMatrixTable.pricePerPerson,
    })
    .from(pricingMatrixTable)
    .where(
      and(
        lte(pricingMatrixTable.distanceMinKm, distanceKm),
        gt(pricingMatrixTable.distanceMaxKm, distanceKm),
        eq(pricingMatrixTable.passengersMin, 1),
      )
    )
    .limit(1);

  if (baseRows.length === 0) {
    return { pricePerPerson: 0, price: 0, needsAdminReview: true, distanceKm, numberOfPeople: passengers };
  }

  const row = baseRows[0]!;
  const priceSar = row.priceSar ?? row.pricePerPerson;
  if (priceSar == null || priceSar <= 0) {
    return { pricePerPerson: 0, price: 0, needsAdminReview: true, distanceKm, numberOfPeople: passengers };
  }

  const passengersMax = row.passengersMax ?? 4;
  const effectivePassengers = Math.min(passengers, passengersMax);
  const pricePerPerson = priceSar / effectivePassengers;

  return {
    pricePerPerson,
    price: pricePerPerson * effectivePassengers,
    needsAdminReview: false,
    distanceKm,
    numberOfPeople: effectivePassengers,
  };
}

// ─── Helper: upsert a single app_config key ──────────────────────────────────

async function upsertConfig(key: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(appConfigTable)
    .where(eq(appConfigTable.key, key));

  if (existing.length > 0) {
    await db
      .update(appConfigTable)
      .set({ value })
      .where(eq(appConfigTable.key, key));
  } else {
    await db.insert(appConfigTable).values({ key, value });
  }
}

// ─── GET /pricing/config ──────────────────────────────────────────────────────
// Returns the full pricing configuration (any authenticated user)

router.get("/config", requireAuth(), async (_req, res) => {
  try {
    const config = await loadPricingConfig();
    res.json(config);
  } catch (err) {
    logger.error({ err }, "pricing GET /config error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── GET /pricing/engine ──────────────────────────────────────────────────────
// Admin: get current pricing engine and formula_v2 constants

router.get("/engine", requireAuth("admin"), async (_req, res) => {
  try {
    const runtime = await loadPricingRuntimeConfig();
    res.json({
      engine: runtime.engine,
      shadowCompare: runtime.shadowCompare,
      formulaConstants: runtime.formulaConstants,
      defaultEngine: DEFAULT_PRICING_ENGINE,
    });
  } catch (err) {
    logger.error({ err }, "pricing GET /engine error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── PATCH /pricing/config ────────────────────────────────────────────────────
// Admin: update any subset of pricing config (tiers, discounts, proximity, engine)

router.patch("/config", requireAuth("admin"), async (req, res) => {
  const {
    tiers,
    sharingDiscounts,
    proximityHomeKm,
    proximityWorkKm,
    proximityTimeMinutes,
    engine,
    shadowCompare,
    pricePerKm,
    visitFee,
    extraLocationRate,
    weeks,
  } = req.body ?? {};

  try {
    if (tiers !== undefined) {
      if (!Array.isArray(tiers) || tiers.some((t: PricingTier) => typeof t.max !== "number" || typeof t.base !== "number")) {
        res.status(400).json({ error: "صيغة نطاقات المسافة غير صحيحة" });
        return;
      }
      await upsertConfig("pricing_tiers", JSON.stringify(tiers));
    }

    if (sharingDiscounts !== undefined) {
      if (!Array.isArray(sharingDiscounts) || sharingDiscounts.some((d: SharingDiscount) => typeof d.people !== "number" || typeof d.factor !== "number")) {
        res.status(400).json({ error: "صيغة خصومات المشاركة غير صحيحة" });
        return;
      }
      await upsertConfig("sharing_discounts", JSON.stringify(sharingDiscounts));
    }

    if (proximityHomeKm !== undefined) {
      const val = parseFloat(proximityHomeKm);
      if (isNaN(val) || val <= 0) { res.status(400).json({ error: "مسافة القرب للمنازل غير صحيحة" }); return; }
      await upsertConfig("proximity_home_km", String(val));
    }

    if (proximityWorkKm !== undefined) {
      const val = parseFloat(proximityWorkKm);
      if (isNaN(val) || val <= 0) { res.status(400).json({ error: "مسافة القرب لجهات العمل غير صحيحة" }); return; }
      await upsertConfig("proximity_work_km", String(val));
    }

    if (proximityTimeMinutes !== undefined) {
      const val = parseFloat(proximityTimeMinutes);
      if (isNaN(val) || val <= 0) { res.status(400).json({ error: "فارق الوقت المسموح غير صحيح" }); return; }
      await upsertConfig("proximity_time_minutes", String(val));
    }

    // Pricing engine selector
    if (engine !== undefined) {
      if (engine !== "matrix" && engine !== "formula_v2") {
        res.status(400).json({ error: "محرك التسعير يجب أن يكون 'matrix' أو 'formula_v2'" });
        return;
      }
      await upsertConfig("pricing_engine", engine);
      logger.info({ engine }, "pricing: engine switched by admin");
    }

    if (shadowCompare !== undefined) {
      await upsertConfig("pricing_shadow_compare", shadowCompare ? "true" : "false");
    }

    // formula_v2 constants
    if (pricePerKm !== undefined) {
      const val = parseStrictPositiveNumber(String(pricePerKm), 0);
      if (val <= 0) { res.status(400).json({ error: "سعر الكيلومتر يجب أن يكون رقماً موجباً" }); return; }
      await upsertConfig("pricing_v2_price_per_km", String(val));
    }
    if (visitFee !== undefined) {
      const val = parseStrictPositiveNumber(String(visitFee), 0);
      if (val <= 0) { res.status(400).json({ error: "رسوم الزيارة يجب أن تكون رقماً موجباً" }); return; }
      await upsertConfig("pricing_v2_visit_fee", String(val));
    }
    if (extraLocationRate !== undefined) {
      const val = parseStrictPositiveNumber(String(extraLocationRate), 0);
      if (val <= 0) { res.status(400).json({ error: "معدل الموقع الإضافي يجب أن يكون رقماً موجباً" }); return; }
      await upsertConfig("pricing_v2_extra_location_rate", String(val));
    }
    if (weeks !== undefined) {
      const val = parseStrictPositiveNumber(String(weeks), 0);
      if (val <= 0) { res.status(400).json({ error: "عدد الأسابيع يجب أن يكون رقماً موجباً" }); return; }
      await upsertConfig("pricing_v2_weeks", String(val));
    }

    const updated = await loadPricingConfig();
    const runtime = await loadPricingRuntimeConfig();
    res.json({ ...updated, engine: runtime.engine, shadowCompare: runtime.shadowCompare });
  } catch (err) {
    logger.error({ err }, "pricing PATCH /config error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── POST /pricing/calculate ──────────────────────────────────────────────────
// Calculate price server-side from coordinates and parameters

router.post("/calculate", requireAuth(), async (req, res) => {
  const {
    homeLat, homeLng, destLat, destLng,
    numberOfPeople,
    distanceKm: clientDistanceKm,
    workingDaysPerWeek,
    numberOfShifts,
    shifts,
    additionalLocations,
    locations,
    type,
  } = req.body ?? {};

  try {
    // Calculate or use provided distance
    let distKm: number | null = null;
    if (typeof homeLat === "number" && typeof homeLng === "number" &&
        typeof destLat === "number" && typeof destLng === "number") {
      distKm = haversineKm(homeLat, homeLng, destLat, destLng);
    } else if (typeof clientDistanceKm === "number") {
      distKm = clientDistanceKm;
    }

    if (distKm === null) {
      res.status(400).json({ error: "يجب تحديد الإحداثيات أو المسافة لحساب السعر" });
      return;
    }

    const result = await calculatePriceForRequest({
      distanceKm: distKm,
      numberOfPeople: Number(numberOfPeople) || 1,
      workingDaysPerWeek: Number(workingDaysPerWeek) || 5,
      numberOfShifts: Number(numberOfShifts) || null,
      shifts: Array.isArray(shifts) ? shifts : null,
      additionalLocations: Array.isArray(additionalLocations) ? additionalLocations : null,
      locations: Number(locations) || null,
      type: type ?? null,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "pricing POST /calculate error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── GET /pricing/suggestions ─────────────────────────────────────────────────
// Find nearby OPEN requests that could share this subscription (for a new request)

router.get("/suggestions", requireAuth("client"), async (req, res) => {
  const homeLat = parseFloat(req.query["homeLat"] as string);
  const homeLng = parseFloat(req.query["homeLng"] as string);
  const destLat = parseFloat(req.query["destLat"] as string);
  const destLng = parseFloat(req.query["destLng"] as string);
  const morningTime = req.query["morningTime"] as string | undefined;

  if ([homeLat, homeLng, destLat, destLng].some(isNaN)) {
    res.status(400).json({ error: "الإحداثيات غير صحيحة" });
    return;
  }

  try {
    const config = await loadPricingConfig();

    // Fetch OPEN requests that have coordinates
    const openRequests = await db
      .select()
      .from(requestsTable)
      .where(
        and(
          eq(requestsTable.status, "OPEN"),
          eq(requestsTable.needsAdminReview, false),
        )
      );

    const nearby = openRequests.filter((r) => {
      if (r.homeLat == null || r.homeLng == null || r.destLat == null || r.destLng == null) return false;

      // Home proximity
      const homeDist = haversineKm(homeLat, homeLng, r.homeLat, r.homeLng);
      if (homeDist > config.proximityHomeKm) return false;

      // Workplace proximity
      const workDist = haversineKm(destLat, destLng, r.destLat, r.destLng);
      if (workDist > config.proximityWorkKm) return false;

      // Time proximity (optional)
      if (morningTime && r.morningTime) {
        const toMinutes = (t: string) => {
          const parts = t.split(":");
          const h = parseInt(parts[0] ?? "0", 10);
          const m = parseInt(parts[1] ?? "0", 10);
          return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
        };
        const diff = Math.abs(toMinutes(morningTime) - toMinutes(r.morningTime));
        if (diff > config.proximityTimeMinutes) return false;
      }

      return true;
    });

    res.json({
      count: nearby.length,
      suggestions: nearby.map((r) => ({
        id: r.id,
        homeLocation: r.homeLocation,
        workLocation: r.workLocation,
        morningTime: r.morningTime,
        numberOfPeople: r.numberOfPeople,
      })),
    });
  } catch (err) {
    logger.error({ err }, "pricing GET /suggestions error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── GET /pricing/review-requests ────────────────────────────────────────────
// Admin: list requests that need admin review (distance > 40km)

router.get("/review-requests", requireAuth("admin"), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.needsAdminReview, true));

    res.json(
      rows.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        homeLocation: r.homeLocation,
        workLocation: r.workLocation,
        distanceKm: r.distanceKm,
        numberOfPeople: r.numberOfPeople,
        morningTime: r.morningTime,
        status: r.status,
        monthlyPrice: r.monthlyPrice != null ? parseFloat(String(r.monthlyPrice)) : 0,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "pricing GET /review-requests error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── Legacy endpoints (keep for backward compat) ─────────────────────────────

router.get("/", requireAuth(), async (_req, res) => {
  try {
    const config = await loadPricingConfig();
    // Legacy response format
    res.json({
      minMonthlyPrice: config.tiers[0]?.base ?? 500,
      suggestedPricePerPerson: config.tiers[0]?.base ?? 500,
    });
  } catch (err) {
    logger.error({ err }, "pricing GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.patch("/", requireAuth("admin"), async (req, res) => {
  const { minMonthlyPrice } = req.body ?? {};

  try {
    if (minMonthlyPrice !== undefined) {
      const val = parseFloat(minMonthlyPrice);
      if (isNaN(val) || val < 0) {
        res.status(400).json({ error: "الحد الأدنى للسعر يجب أن يكون رقماً موجباً" });
        return;
      }
      await upsertConfig("min_monthly_price", String(val));
    }
    res.json({ message: "تم تحديث إعدادات التسعير" });
  } catch (err) {
    logger.error({ err }, "pricing PATCH / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
