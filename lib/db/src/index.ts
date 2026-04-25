import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set.",
  );
}

// Enable SSL when the connection targets Supabase (whether supplied via
// SUPABASE_DATABASE_URL or via DATABASE_URL that points at Supabase).
// Use URL parsing to match only the hostname, not substrings in credentials
// or query parameters.
let isSupabase = !!process.env.SUPABASE_DATABASE_URL;
if (!isSupabase) {
  try {
    const { hostname } = new URL(connectionString);
    isSupabase =
      hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  } catch {
    // Unparseable connection string — assume not Supabase
  }
}

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
