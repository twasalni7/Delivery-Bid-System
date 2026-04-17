import { Router } from "express";
import { db } from "@workspace/db";
import { requestsTable, driversTable, offersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  const [totalRequestsResult] = await db.select({ count: count() }).from(requestsTable);
  const [openResult] = await db.select({ count: count() }).from(requestsTable).where(eq(requestsTable.status, "OPEN"));
  const [selectedResult] = await db.select({ count: count() }).from(requestsTable).where(eq(requestsTable.status, "SELECTED"));
  const [activeResult] = await db.select({ count: count() }).from(requestsTable).where(eq(requestsTable.status, "ACTIVE"));
  const [completedResult] = await db.select({ count: count() }).from(requestsTable).where(eq(requestsTable.status, "COMPLETED"));
  const [totalDriversResult] = await db.select({ count: count() }).from(driversTable);
  const [totalOffersResult] = await db.select({ count: count() }).from(offersTable);

  res.json({
    totalRequests: Number(totalRequestsResult.count),
    openRequests: Number(openResult.count),
    selectedRequests: Number(selectedResult.count),
    activeRequests: Number(activeResult.count),
    completedRequests: Number(completedResult.count),
    totalDrivers: Number(totalDriversResult.count),
    totalOffers: Number(totalOffersResult.count),
  });
});

export default router;
