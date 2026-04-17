import { db } from "./index";
import { adminsTable, driversTable, requestsTable, clientsTable } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 بدء تهيئة قاعدة البيانات...");

  const existingAdmin = await db.query.adminsTable.findFirst({
    where: eq(adminsTable.loginCode, "ADMIN2024"),
  });

  if (!existingAdmin) {
    const [admin] = await db
      .insert(adminsTable)
      .values({ name: "مشرف النظام", loginCode: "ADMIN2024" })
      .returning();
    console.log("✅ تم إنشاء حساب المشرف:", admin.loginCode);
  } else {
    console.log("ℹ️  حساب المشرف موجود مسبقاً:", existingAdmin.loginCode);
  }

  console.log("✅ اكتملت تهيئة قاعدة البيانات");
}

seed().catch(console.error).finally(() => process.exit(0));
