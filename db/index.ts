import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

declare global {
  var nightlyPostgresPool: Pool | undefined;
}

const poolConfig = {
  connectionString: databaseUrl,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
};

const pool = globalThis.nightlyPostgresPool ?? new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalThis.nightlyPostgresPool = pool;
}

export const db = drizzle(pool, { schema });