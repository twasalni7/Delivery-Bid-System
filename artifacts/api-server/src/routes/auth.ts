import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "../lib/auth";

const router = Router();

router.post("/register-client", async (req, res) => {
  const { name, mobile, password } = req.body ?? {};
  if (!name || !mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الاسم والجوال وكلمة المرور" });
    return;
  }
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
  req.session.user = { id: client.id, role: "client", name: client.name };
  res.status(201).json({
    id: client.id,
    name: client.name,
    mobile: client.mobile,
    role: "client",
  });
});

router.post("/login-client", async (req, res) => {
  const { mobile, password } = req.body ?? {};
  if (!mobile || !password) {
    res.status(400).json({ error: "يرجى إدخال الجوال وكلمة المرور" });
    return;
  }
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
  req.session.user = { id: client.id, role: "client", name: client.name };
  res.json({
    id: client.id,
    name: client.name,
    mobile: client.mobile,
    role: "client",
  });
});

router.post("/login-driver", async (req, res) => {
  const { mobile, loginCode } = req.body ?? {};
  if (!mobile || !loginCode) {
    res.status(400).json({ error: "يرجى إدخال الجوال ورمز التسجيل" });
    return;
  }
  const driver = await db.query.driversTable.findFirst({
    where: eq(driversTable.mobile, mobile),
  });
  if (!driver || driver.loginCode !== loginCode) {
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
  req.session.user = { id: driver.id, role: "driver", name: driver.name };
  res.json({
    id: driver.id,
    name: driver.name,
    mobile: driver.mobile,
    balance: driver.balance,
    status: driver.status,
    role: "driver",
  });
});

router.post("/login-admin", async (req, res) => {
  const { loginCode } = req.body ?? {};
  if (!loginCode) {
    res.status(400).json({ error: "يرجى إدخال رمز الدخول" });
    return;
  }
  const admin = await db.query.adminsTable.findFirst({
    where: eq(adminsTable.loginCode, loginCode),
  });
  if (!admin) {
    res.status(401).json({ error: "رمز الدخول غير صحيح" });
    return;
  }
  req.session.user = { id: admin.id, role: "admin", name: admin.name };
  res.json({
    id: admin.id,
    name: admin.name,
    role: "admin",
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "تم تسجيل الخروج" });
  });
});

router.get("/me", (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "غير مسجّل الدخول" });
    return;
  }
  res.json(user);
});

router.patch("/me/client", async (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== "client") {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const { name, mobile } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name && typeof name === "string") updates.name = name.trim();
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
  req.session.user = { ...user, name: updated.name };
  res.json({ id: updated.id, name: updated.name, mobile: updated.mobile });
});

router.patch("/me/password", async (req, res) => {
  const user = req.session.user;
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
});

export default router;
