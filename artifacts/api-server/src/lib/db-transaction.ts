import { db } from "@workspace/db";

/**
 * Runs `callback` inside a database transaction when the Drizzle client
 * supports one, otherwise falls back to executing the callback directly
 * (useful in tests where the mock does not expose `.transaction()`).
 *
 * `meta.hasRealTransaction` tells the callback whether a real ACID
 * transaction is active.  When it is false the callback is responsible for
 * manual compensating updates on failure.
 */
export async function withDbTransaction<T>(
  callback: (tx: typeof db, meta: { hasRealTransaction: boolean }) => Promise<T>,
): Promise<T> {
  const dbWithTransaction = db as typeof db & {
    transaction?: <R>(cb: (tx: typeof db) => Promise<R>) => Promise<R>;
  };
  if (typeof dbWithTransaction.transaction === "function") {
    return dbWithTransaction.transaction((tx) => callback(tx, { hasRealTransaction: true }));
  }
  return callback(db, { hasRealTransaction: false });
}
