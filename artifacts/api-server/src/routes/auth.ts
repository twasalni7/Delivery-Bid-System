import { Router, Request } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable, userTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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
  return new Promise((resolve, reject) =>
    req.session.regenerate((err: unknown) =>
      err ? reject(err) : resolve()
    )
  );
}

router.post("/register-client", async (req, res) => {
  const { name, mobile, password } = req.body ?? {};
  if (!name || !mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الاسم والجوال وكلمة المرور" });
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
    await regenerateSession(req);
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
    await regenerateSession(req);
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
  const { mobile, loginCode } = req.body ?? {};
  if (!mobile || !loginCode) {
    res.status(400).json({ error: "يرجى إدخال الجوال ورمز التسجيل" });
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
    await regenerateSession(req);
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
    await regenerateSession(req);
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

export default router;
