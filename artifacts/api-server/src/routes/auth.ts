import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, driversTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword } from "../lib/auth";

const router = Router();

router.post("/client/register", async (req, res) => {
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

router.post("/client/login", async (req, res) => {
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

router.post("/driver/login", async (req, res) => {
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
    res.status(403).json({ error: "تم إيقاف حسابك. يرجى التواصل مع الإدارة" });
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

router.post("/admin/login", async (req, res) => {
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
  if (!req.session?.user) {
    res.status(401).json({ error: "غير مسجّل الدخول" });
    return;
  }
  res.json(req.session.user);
});

export default router;
