import { Router } from "express";
import { db } from "@workspace/db";
import {
  driverRegistrationRequestsTable,
  driversTable,
  insertDriverRegistrationRequestSchema,
} from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getSessionUser } from "../lib/session";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";
import { randomBytes, createHash } from "crypto";
import { hashPassword } from "../lib/auth";

const router = Router();

const SERVER_ERROR_MSG = "حدث خطأ في الخادم، يرجى المحاولة لاحقاً";

// Helper function to generate login code
function generateLoginCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Helper function to generate temporary password
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

// Submit new driver registration request (public endpoint)
router.post("/", async (req, res) => {
  const parsed = insertDriverRegistrationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة أو ناقصة" });
    return;
  }

  try {
    // Check if mobile already exists as a driver
    const existingDriver = await db.query.driversTable.findFirst({
      where: eq(driversTable.mobile, parsed.data.mobile),
    });

    if (existingDriver) {
      res.status(400).json({ error: "رقم الجوال مسجّل مسبقاً" });
      return;
    }

    // Check for pending request with same mobile
    const existingRequest =
      await db.query.driverRegistrationRequestsTable.findFirst({
        where: eq(
          driverRegistrationRequestsTable.mobile,
          parsed.data.mobile
        ),
      });

    if (existingRequest && existingRequest.status === "PENDING") {
      res.status(400).json({ error: "يوجد طلب معلق لهذا الرقم" });
      return;
    }

    const [request] = await db
      .insert(driverRegistrationRequestsTable)
      .values(parsed.data)
      .returning();

    res.status(201).json({
      id: request.id,
      message: "تم تقديم طلبك بنجاح. سيتم مراجعته من قبل الإدارة",
    });
  } catch (err) {
    logger.error({ err }, "driver-registration POST error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// List all registration requests (admin only)
router.get("/", requireAuth("admin"), async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(driverRegistrationRequestsTable)
      .orderBy(driverRegistrationRequestsTable.createdAt);

    res.json(
      requests.map((r) => ({
        id: r.id,
        name: r.name,
        mobile: r.mobile,
        city: r.city,
        carType: r.carType,
        carYear: r.carYear,
        nationality: r.nationality,
        nationalId: r.nationalId,
        age: r.age,
        status: r.status,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt?.toISOString(),
        rejectionReason: r.rejectionReason,
        createdDriverId: r.createdDriverId,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "driver-registration GET error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Approve registration request (admin only)
router.patch("/:id/approve", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  try {
    const request = await db.query.driverRegistrationRequestsTable.findFirst({
      where: eq(driverRegistrationRequestsTable.id, id),
    });

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (request.status !== "PENDING") {
      res.status(400).json({ error: "الطلب تمت معالجته مسبقاً" });
      return;
    }

    // Check if mobile already registered
    const existingDriver = await db.query.driversTable.findFirst({
      where: eq(driversTable.mobile, request.mobile),
    });

    if (existingDriver) {
      res.status(400).json({ error: "رقم الجوال مسجّل مسبقاً" });
      return;
    }

    // Generate credentials
    const loginCode = generateLoginCode();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    // Create driver
    const [newDriver] = await db
      .insert(driversTable)
      .values({
        name: request.name,
        mobile: request.mobile,
        city: request.city,
        carType: request.carType,
        carYear: request.carYear,
        nationality: request.nationality,
        nationalId: request.nationalId,
        age: request.age,
        loginCode,
        passwordHash,
        requiresPasswordReset: 1, // Force password change on first login
      })
      .returning();

    // Update request status
    await db
      .update(driverRegistrationRequestsTable)
      .set({
        status: "APPROVED",
        approvedBy: getSessionUser(req)!.id,
        approvedAt: new Date(),
        createdDriverId: newDriver.id,
      })
      .where(eq(driverRegistrationRequestsTable.id, id));

    await logActivity({
      actorId: getSessionUser(req)!.id,
      actorRole: "admin",
      action: "driver_registration.approved",
      entity: "driver_registration_requests",
      entityId: id,
      metadata: { driverId: newDriver.id },
      req,
    });

    res.json({
      message: "تمت الموافقة على الطلب وإنشاء حساب السائق",
      driver: {
        id: newDriver.id,
        name: newDriver.name,
        mobile: newDriver.mobile,
        loginCode,
        temporaryPassword,
      },
    });
  } catch (err) {
    logger.error({ err }, "driver-registration approve error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

// Reject registration request (admin only)
router.patch("/:id/reject", requireAuth("admin"), async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }

  const { rejectionReason } = req.body ?? {};

  try {
    const request = await db.query.driverRegistrationRequestsTable.findFirst({
      where: eq(driverRegistrationRequestsTable.id, id),
    });

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (request.status !== "PENDING") {
      res.status(400).json({ error: "الطلب تمت معالجته مسبقاً" });
      return;
    }

    await db
      .update(driverRegistrationRequestsTable)
      .set({
        status: "REJECTED",
        approvedBy: getSessionUser(req)!.id,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || "لم يتم تحديد سبب",
      })
      .where(eq(driverRegistrationRequestsTable.id, id));

    await logActivity({
      actorId: getSessionUser(req)!.id,
      actorRole: "admin",
      action: "driver_registration.rejected",
      entity: "driver_registration_requests",
      entityId: id,
      metadata: { rejectionReason },
      req,
    });

    res.json({ message: "تم رفض الطلب" });
  } catch (err) {
    logger.error({ err }, "driver-registration reject error");
    res.status(500).json({ error: SERVER_ERROR_MSG });
  }
});

export default router;
