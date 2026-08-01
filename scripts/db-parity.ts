import { config } from "dotenv";

import { sql } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db");
  const [ledgerRows, tablesRows] = await Promise.all([
    db.execute<{ count: string; latest: string | null }>(
      sql`select count(*)::text as count, max(created_at)::text as latest from drizzle.__drizzle_migrations`
    ),
    db.execute<{ count: string }>(
      sql`select count(*)::text as count from information_schema.tables where table_schema='public'`
    ),
  ]);

  const result = {
    migrationLedgerCount: Number.parseInt(ledgerRows.rows[0]?.count ?? "0", 10),
    latestMigrationAt: ledgerRows.rows[0]?.latest ?? null,
    publicTableCount: Number.parseInt(tablesRows.rows[0]?.count ?? "0", 10),
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db-parity failed");
  process.exitCode = 1;
});
