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

// ─── Helper: load pricing config from DB ──────────────────────────────────────

export async function loadPricingConfig(): Promise<PricingConfig> {
  try {
    const rows = await db.select().from(appConfigTable);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

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

// ─── PATCH /pricing/config ────────────────────────────────────────────────────
// Admin: update any subset of pricing config

router.patch("/config", requireAuth("admin"), async (req, res) => {
  const { tiers, sharingDiscounts, proximityHomeKm, proximityWorkKm, proximityTimeMinutes } =
    req.body ?? {};

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

    const updated = await loadPricingConfig();
    res.json(updated);
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

    const result = await getPriceFromMatrix(distKm, Number(numberOfPeople) || 1);
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
