import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  calculateRoutePlan,
  reverseGeocode,
  searchPlaces,
  type RoutePoint,
  isOpenRouteServiceConfigured,
} from "../lib/maps";
import { logger } from "../lib/logger";

const router = Router();
const SERVER_ERROR_MSG = "حدث خطأ في خدمة الخرائط";

router.get("/search", requireAuth(), async (req, res) => {
  const q = String(req.query["q"] ?? "");
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 6), 1), 10);
  if (q.trim().length < 2) {
    res.json([]);
    return;
  }

  try {
    res.json(await searchPlaces(q, limit));
  } catch (err) {
    logger.error({ err, query: q }, "maps GET /search error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/reverse", requireAuth(), async (req, res) => {
  const lat = Number(req.query["lat"]);
  const lng = Number(req.query["lng"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "إحداثيات غير صحيحة" });
    return;
  }

  try {
    res.json({ address: await reverseGeocode(lat, lng) });
  } catch (err) {
    logger.error({ err, lat, lng }, "maps GET /reverse error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

router.get("/status", requireAuth("admin"), (_req, res) => {
  res.json({
    provider: "openrouteservice",
    configured: isOpenRouteServiceConfigured(),
  });
});

router.post("/route", requireAuth(), async (req, res) => {
  const points = Array.isArray(req.body?.points) ? req.body.points : [];
  const normalized = points
    .map((point): RoutePoint | null => {
      const lat = Number(point?.lat);
      const lng = Number(point?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        lat,
        lng,
        address: typeof point?.address === "string" ? point.address : null,
        type: typeof point?.type === "string" ? point.type : null,
      };
    })
    .filter((point): point is RoutePoint => point !== null);

  if (normalized.length < 2) {
    res.status(400).json({ error: "يلزم نقطتا انطلاق ووصول على الأقل" });
    return;
  }

  try {
    res.json(await calculateRoutePlan(normalized));
  } catch (err) {
    const message = err instanceof Error ? err.message : "route_calculation_failed";
    const status = message === "openrouteservice_not_configured" ? 503 : 500;
    logger.error({ err, points: normalized }, "maps POST /route error");
    res.status(status).json({ error: message === "openrouteservice_not_configured" ? "خدمة المسارات غير مهيأة" : SERVER_ERROR_MSG });
  }
});

export default router;
