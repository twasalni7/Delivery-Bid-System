import { Router, Request } from "express";
import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable, userTokensTable, passwordResetTokensTable } from "@workspace/db";
import { eq, inArray, and, gt } from "drizzle-orm";
import { hashPassword, comparePassword } from "../lib/auth";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";

const router = Router();

// Token lifetime: 30 days
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function createAuthToken(
  userId: number,
  role: "client" | "driver" | "admin",
  name: string,
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(userTokensTable).values({ token, userId, role, name, expiresAt });
  return token;
}

async function deleteAuthToken(req: Request): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return;
  const token = authHeader.slice(7).trim();
  if (!token) return;
  try {
    await db.delete(userTokensTable).where(eq(userTokensTable.token, token));
  } catch {
    // Ignore errors during token cleanup
  }
}

// Mobile validation: must contain only digits and optional leading +, length 9-15
const MOBILE_RE = /^\+?[0-9]{9,15}$/;

function validateMobile(mobile: unknown): boolean {
  return typeof mobile === "string" && MOBILE_RE.test(mobile.trim());
}

/**
 * Normalize a Saudi driver mobile to the canonical "05XXXXXXXX" format.
 * Handles:
 *   "5XXXXXXXX"       (9 digits, no leading 0)  → "05XXXXXXXX"
 *   "966XXXXXXXXX"    (12 digits, country code)  → "05XXXXXXXX"
 *   "+966XXXXXXXXX"   (with plus)                → "05XXXXXXXX"
 *   "05XXXXXXXX"      (already canonical)        → unchanged
 */
export function normalizeDriverMobile(mobile: string): string {
  const digits = mobile.trim().replace(/\D/g, "");
  if (digits.startsWith("966") && digits.length === 12) return "0" + digits.slice(3);
  if (digits.startsWith("5") && digits.length === 9) return "0" + digits;
  return digits;
}

/**
 * Build equivalent driver mobile variants for login lookup to support both
 * legacy 9-digit values and canonical 10-digit values with leading zero.
 */
function getDriverMobileLoginCandidates(mobile: string): string[] {
  const normalized = normalizeDriverMobile(mobile);
  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith("05") && normalized.length === 10) {
    candidates.add(normalized.slice(1)); // legacy format without leading zero
  }
  return [...candidates];
}

function normalizeLoginCode(code: string): string {
  return code.trim().toUpperCase();
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    req.session.regenerate((err: unknown) =>
      err ? reject(err) : resolve()
    )
  );
}

async function regenerateSessionBestEffort(req: Request, route: string): Promise<void> {
  try {
    await regenerateSession(req);
  } catch (err) {
    // Log only the error code and message — never the full error object or request
    // data — to avoid leaking session store internals or user-identifiable fields.
    logger.warn(
      {
        route,
        errCode: (err as NodeJS.ErrnoException).code ?? "SESSION_REGENERATION_ERROR",
        errMessage: (err as Error).message,
      },
      "auth: session regeneration failed; login continues via bearer token",
    );
  }
}

router.post("/register-client", async (req, res) => {
  const { name, mobile, password } = req.body ?? {};
  if (!name || !mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الاسم والجوال وكلمة المرور" });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }
  if (!validateMobile(mobile)) {
    res.status(400).json({ error: "رقم الجوال غير صحيح" });
    return;
  }
  try {
    const existing = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.mobile, mobile),
    });
    if (existing) {
      res.status(400).json({ error: "رقم الجوال مسجّل مسبقاً" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const [client] = await db
      .insert(clientsTable)
      .values({ name, mobile, passwordHash })
      .returning();
    await regenerateSessionBestEffort(req, "register-client");
    const token = await createAuthToken(client.id, "client", client.name);
    await logActivity({ actorId: client.id, actorRole: "client", action: "client.registered", entity: "clients", entityId: client.id, req });
    res.status(201).json({
      id: client.id,
      name: client.name,
      mobile: client.mobile,
      role: "client",
      token,
    });
  } catch (err) {
    logger.error({ err }, "register-client error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.post("/login-client", async (req, res) => {
  const { mobile, password } = req.body ?? {};
  if (!mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الجوال وكلمة المرور" });
    return;
  }
  try {
    const client = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.mobile, mobile),
    });
    if (!client) {
      res.status(401).json({ error: "رقم الجوال أو كلمة المرور غير صحيحة" });
      return;
    }
    const valid = await comparePassword(password, client.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "رقم الجوال أو كلمة المرور غير صحيحة" });
      return;
    }
    await regenerateSessionBestEffort(req, "login-client");
    const token = await createAuthToken(client.id, "client", client.name);
    await logActivity({ actorId: client.id, actorRole: "client", action: "auth.login", entity: "clients", entityId: client.id, req });
    res.json({
      id: client.id,
      name: client.name,
      mobile: client.mobile,
      role: "client",
      token,
    });
  } catch (err) {
    logger.error({ err }, "login-client error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.post("/login-driver", async (req, res) => {
  const { mobile, loginCode, password } = req.body ?? {};
  if (!mobile) {
    res.status(400).json({ error: "يرجى إدخال الجوال" });
    return;
  }
  if (!loginCode && !password) {
    res.status(400).json({ error: "يرجى إدخال رمز التسجيل أو كلمة المرور" });
    return;
  }
  try {
    const mobileCandidates = getDriverMobileLoginCandidates(String(mobile));
    const driver = await db.query.driversTable.findFirst({
      where: inArray(driversTable.mobile, mobileCandidates),
    });

    if (!driver) {
      res.status(401).json({ error: "رقم الجوال أو بيانات الدخول غير صحيحة" });
      return;
    }

    // Authentication logic
    let isAuthenticated = false;

    // Case 1: Login with password (new system)
    if (password && driver.passwordHash) {
      isAuthenticated = await comparePassword(password, driver.passwordHash);
    }
    // Case 2: Login with loginCode (legacy system or first-time users)
    else if (loginCode) {
      const normalizedLoginCode = normalizeLoginCode(String(loginCode));
      isAuthenticated = normalizeLoginCode(String(driver.loginCode)) === normalizedLoginCode;
    }

    if (!isAuthenticated) {
      res.status(401).json({ error: "رقم الجوال أو بيانات الدخول غير صحيحة" });
      return;
    }

    if (driver.status === "BLOCKED") {
      res
        .status(403)
        .json({ error: "تم إيقاف حسابك. يرجى التواصل مع الإدارة" });
      return;
    }
    if (driver.status === "DELETED") {
      res.status(403).json({ error: "هذا الحساب غير متاح" });
      return;
    }

    await regenerateSessionBestEffort(req, "login-driver");
    const token = await createAuthToken(driver.id, "driver", driver.name);
    await logActivity({ actorId: driver.id, actorRole: "driver", action: "auth.login", entity: "drivers", entityId: driver.id, req });

    res.json({
      id: driver.id,
      name: driver.name,
      mobile: driver.mobile,
      balance: driver.balance,
      status: driver.status,
      role: "driver",
      token,
      requiresPasswordReset: !driver.passwordHash || driver.requiresPasswordReset === 1,
    });
  } catch (err) {
    logger.error({ err }, "login-driver error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.post("/login-admin", async (req, res) => {
  const { loginCode } = req.body ?? {};

  if (!loginCode) {
    res.status(400).json({ error: "يرجى إدخال رمز الدخول" });
    return;
  }

  try {
    const admin = await db.query.adminsTable.findFirst({
      where: eq(adminsTable.loginCode, loginCode),
    });

    if (!admin) {
      res.status(401).json({ error: "رمز الدخول غير صحيح" });
      return;
    }

    await regenerateSessionBestEffort(req, "login-admin");
    const token = await createAuthToken(admin.id, "admin", admin.name);
    await logActivity({ actorId: admin.id, actorRole: "admin", action: "auth.login", entity: "admins", entityId: admin.id, req });
    res.json({
      id: admin.id,
      name: admin.name,
      role: "admin",
      token,
    });
  } catch (err) {
    logger.error({ err }, "login-admin error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.post("/logout", async (req, res) => {
  await deleteAuthToken(req);
  req.session.destroy(() => {
    res.json({ message: "تم تسجيل الخروج" });
  });
});

router.get("/me", (req, res) => {
  const user = req.session.user ?? req.tokenUser;
  if (!user) {
    res.status(401).json({ error: "غير مسجّل الدخول" });
    return;
  }
  res.json(user);
});

router.patch("/me/client", async (req, res) => {
  const user = req.session.user ?? req.tokenUser;
  if (!user || user.role !== "client") {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const { name, mobile } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name && typeof name === "string") updates.name = name.trim();
  try {
    if (mobile && typeof mobile === "string") {
      const existing = await db.query.clientsTable.findFirst({
        where: eq(clientsTable.mobile, mobile),
      });
      if (existing && existing.id !== user.id) {
        res.status(400).json({ error: "رقم الجوال مسجّل لعميل آخر" });
        return;
      }
      updates.mobile = mobile;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }
    const [updated] = await db
      .update(clientsTable)
      .set(updates)
      .where(eq(clientsTable.id, user.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }
    res.json({ id: updated.id, name: updated.name, mobile: updated.mobile });
  } catch (err) {
    logger.error({ err }, "me/client error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

router.patch("/me/password", async (req, res) => {
  const user = req.session.user ?? req.tokenUser;
  if (!user || user.role !== "client") {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    return;
  }
  try {
    const client = await db.query.clientsTable.findFirst({
      where: eq(clientsTable.id, user.id),
    });
    if (!client) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }
    const valid = await comparePassword(currentPassword, client.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await db
      .update(clientsTable)
      .set({ passwordHash: newHash })
      .where(eq(clientsTable.id, user.id));
    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    logger.error({ err }, "me/password error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

// ============= Driver Password Management =============

// Helper function to generate temporary password
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed similar characters
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

// Helper function to hash token
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Set first password for legacy drivers
router.post("/driver/set-first-password", async (req, res) => {
  const { mobile, loginCode, newPassword } = req.body ?? {};
  if (!mobile || !loginCode || !newPassword) {
    res.status(400).json({ error: "يرجى إدخال جميع البيانات المطلوبة" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }
  try {
    const mobileCandidates = getDriverMobileLoginCandidates(String(mobile));
    const normalizedLoginCode = normalizeLoginCode(String(loginCode));
    const driver = await db.query.driversTable.findFirst({
      where: inArray(driversTable.mobile, mobileCandidates),
    });

    if (!driver || normalizeLoginCode(String(driver.loginCode)) !== normalizedLoginCode) {
      res.status(401).json({ error: "رقم الجوال أو رمز التسجيل غير صحيح" });
      return;
    }

    // Only allow if driver doesn't have a password yet
    if (driver.passwordHash) {
      res.status(400).json({ error: "تم تعيين كلمة المرور مسبقاً. استخدم نسيت كلمة المرور لإعادة التعيين" });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(driversTable)
      .set({ passwordHash, requiresPasswordReset: 0 })
      .where(eq(driversTable.id, driver.id));

    await logActivity({
      actorId: driver.id,
      actorRole: "driver",
      action: "driver.password_set",
      entity: "drivers",
      entityId: driver.id,
      req,
    });

    res.json({ message: "تم تعيين كلمة المرور بنجاح" });
  } catch (err) {
    logger.error({ err }, "driver/set-first-password error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

// Request password reset
router.post("/driver/forgot-password", async (req, res) => {
  const { mobile } = req.body ?? {};
  if (!mobile) {
    res.status(400).json({ error: "يرجى إدخال رقم الجوال" });
    return;
  }
  try {
    const mobileCandidates = getDriverMobileLoginCandidates(String(mobile));
    const driver = await db.query.driversTable.findFirst({
      where: inArray(driversTable.mobile, mobileCandidates),
    });

    // Always return success to prevent user enumeration
    if (!driver) {
      res.json({ message: "إذا كان رقم الجوال مسجلاً، سيتم إرسال رمز إعادة التعيين" });
      return;
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate any existing tokens for this driver
    await db
      .delete(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.driverId, driver.id),
          eq(passwordResetTokensTable.usedAt, null)
        )
      );

    // Create new token
    await db.insert(passwordResetTokensTable).values({
      driverId: driver.id,
      tokenHash,
      expiresAt,
    });

    await logActivity({
      actorId: driver.id,
      actorRole: "driver",
      action: "driver.password_reset_requested",
      entity: "drivers",
      entityId: driver.id,
      req,
    });

    // TODO: Send SMS/WhatsApp with reset token
    // For now, return the token in development (should be removed in production)
    res.json({
      message: "تم إرسال رمز إعادة التعيين",
      resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
    });
  } catch (err) {
    logger.error({ err }, "driver/forgot-password error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

// Reset password with token
router.post("/driver/reset-password", async (req, res) => {
  const { mobile, resetToken, newPassword } = req.body ?? {};
  if (!mobile || !resetToken || !newPassword) {
    res.status(400).json({ error: "يرجى إدخال جميع البيانات المطلوبة" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }
  try {
    const mobileCandidates = getDriverMobileLoginCandidates(String(mobile));
    const driver = await db.query.driversTable.findFirst({
      where: inArray(driversTable.mobile, mobileCandidates),
    });

    if (!driver) {
      res.status(401).json({ error: "رقم الجوال أو رمز إعادة التعيين غير صحيح" });
      return;
    }

    const tokenHash = hashToken(resetToken);
    const token = await db.query.passwordResetTokensTable.findFirst({
      where: and(
        eq(passwordResetTokensTable.driverId, driver.id),
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        eq(passwordResetTokensTable.usedAt, null),
        gt(passwordResetTokensTable.expiresAt, new Date())
      ),
    });

    if (!token) {
      res.status(401).json({ error: "رمز إعادة التعيين غير صحيح أو منتهي الصلاحية" });
      return;
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(driversTable)
      .set({ passwordHash, requiresPasswordReset: 0 })
      .where(eq(driversTable.id, driver.id));

    // Mark token as used
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, token.id));

    await logActivity({
      actorId: driver.id,
      actorRole: "driver",
      action: "driver.password_reset",
      entity: "drivers",
      entityId: driver.id,
      req,
    });

    res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح" });
  } catch (err) {
    logger.error({ err }, "driver/reset-password error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

// Change password (requires authentication)
router.patch("/driver/change-password", async (req, res) => {
  const user = req.session.user ?? req.tokenUser;
  if (!user || user.role !== "driver") {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    return;
  }

  try {
    const driver = await db.query.driversTable.findFirst({
      where: eq(driversTable.id, user.id),
    });

    if (!driver || !driver.passwordHash) {
      res.status(404).json({ error: "السائق غير موجود أو لم يتم تعيين كلمة مرور بعد" });
      return;
    }

    const valid = await comparePassword(currentPassword, driver.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await db
      .update(driversTable)
      .set({ passwordHash: newHash })
      .where(eq(driversTable.id, user.id));

    await logActivity({
      actorId: user.id,
      actorRole: "driver",
      action: "driver.password_changed",
      entity: "drivers",
      entityId: user.id,
      req,
    });

    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    logger.error({ err }, "driver/change-password error");
    res.status(500).json({ error: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً" });
  }
});

export default router;
