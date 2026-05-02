import { Router } from "express";
import { db } from "@workspace/db";
import { serviceAreasTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// ─── GET /service-areas ───────────────────────────────────────────────────────
// Any authenticated user: list all active service areas

router.get("/", requireAuth(), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(serviceAreasTable)
      .where(eq(serviceAreasTable.isActive, true))
      .orderBy(asc(serviceAreasTable.city), asc(serviceAreasTable.district));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "service-areas GET / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── GET /service-areas/all ────────────────────────────────────────────────────
// Admin: list all service areas including inactive ones

router.get("/all", requireAuth("admin"), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(serviceAreasTable)
      .orderBy(asc(serviceAreasTable.city), asc(serviceAreasTable.district));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "service-areas GET /all error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── POST /service-areas ──────────────────────────────────────────────────────
// Admin: add a new service area

router.post("/", requireAuth("admin"), async (req, res) => {
  const { city, district, lat, lng } = req.body ?? {};

  if (!city || typeof city !== "string" || city.trim().length === 0) {
    res.status(400).json({ error: "اسم المدينة مطلوب" });
    return;
  }

  try {
    const [created] = await db
      .insert(serviceAreasTable)
      .values({
        city:     city.trim(),
        district: district?.trim() || null,
        lat:      lat != null ? parseFloat(lat) : null,
        lng:      lng != null ? parseFloat(lng) : null,
        isActive: true,
      })
      .returning();

    await logActivity({
      actorRole: "admin",
      action:    "service_area.created",
      entity:    "service_areas",
      entityId:  created?.id,
      metadata:  { city: created?.city, district: created?.district },
      req,
    });

    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "service-areas POST / error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── PATCH /service-areas/:id ─────────────────────────────────────────────────
// Admin: toggle active status or update area data

router.patch("/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const { city, district, lat, lng, isActive } = req.body ?? {};

  const updates: Partial<typeof serviceAreasTable.$inferInsert> = {};
  if (city      !== undefined) updates.city      = city.trim();
  if (district  !== undefined) updates.district  = district?.trim() || null;
  if (lat       !== undefined) updates.lat       = parseFloat(lat);
  if (lng       !== undefined) updates.lng       = parseFloat(lng);
  if (isActive  !== undefined) updates.isActive  = Boolean(isActive);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "لا توجد تحديثات مقدَّمة" });
    return;
  }

  try {
    const [updated] = await db
      .update(serviceAreasTable)
      .set(updates)
      .where(eq(serviceAreasTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }

    await logActivity({
      actorRole: "admin",
      action:    "service_area.updated",
      entity:    "service_areas",
      entityId:  id,
      metadata:  updates as Record<string, unknown>,
      req,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "service-areas PATCH /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// ─── DELETE /service-areas/:id ────────────────────────────────────────────────
// Admin: permanently delete a service area

router.delete("/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  try {
    const [deleted] = await db
      .delete(serviceAreasTable)
      .where(eq(serviceAreasTable.id, id))
      .returning();

    if (!deleted) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }

    await logActivity({
      actorRole: "admin",
      action:    "service_area.deleted",
      entity:    "service_areas",
      entityId:  id,
      metadata:  { city: deleted.city, district: deleted.district },
      req,
    });

    res.json({ message: "تم حذف المنطقة بنجاح" });
  } catch (err) {
    logger.error({ err }, "service-areas DELETE /:id error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
