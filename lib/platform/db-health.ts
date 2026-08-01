import { db } from "@/db";
import { sql } from "drizzle-orm";

export type DbHealthResult = {
  status: "healthy" | "degraded" | "unavailable";
  latencyMs: number;
  migrationLedgerCount: number;
  latestMigrationAt: string | null;
  keyTableChecks: Array<{ table: string; exists: boolean }>;
  errors: string[];
};

const KEY_TABLES = [
  "users",
  "venues",
  "events",
  "bookings",
  "ticket_orders",
  "tickets",
  "admin_audit_events",
  "platform_feature_flags",
  "platform_jobs",
  "webhook_deliveries",
];

export async function getDatabaseHealth(): Promise<DbHealthResult> {
  const startedAt = Date.now();
  const errors: string[] = [];

  try {
    await db.execute(sql`select 1`);

    const [ledgerRows, tableRows] = await Promise.all([
      db.execute<{ count: string; latest: string | null }>(
        sql`select count(*)::text as count, max(created_at)::text as latest from drizzle.__drizzle_migrations`
      ),
      db.execute<{ table_name: string }>(
        sql`select table_name from information_schema.tables where table_schema='public' and table_name in (${sql.join(
          KEY_TABLES.map((table) => sql`${table}`),
          sql`, `
        )})`
      ),
    ]);

    const found = new Set(tableRows.rows.map((row) => row.table_name));
    const keyTableChecks = KEY_TABLES.map((table) => ({ table, exists: found.has(table) }));
    const missing = keyTableChecks.filter((item) => !item.exists);

    if (missing.length > 0) {
      errors.push(`Missing key tables: ${missing.map((item) => item.table).join(", ")}`);
    }

    const latencyMs = Date.now() - startedAt;
    const status = errors.length > 0 ? "degraded" : "healthy";

    return {
      status,
      latencyMs,
      migrationLedgerCount: Number.parseInt(ledgerRows.rows[0]?.count ?? "0", 10),
      latestMigrationAt: ledgerRows.rows[0]?.latest ?? null,
      keyTableChecks,
      errors,
    };
  } catch (error) {
    return {
      status: "unavailable",
      latencyMs: Date.now() - startedAt,
      migrationLedgerCount: 0,
      latestMigrationAt: null,
      keyTableChecks: KEY_TABLES.map((table) => ({ table, exists: false })),
      errors: [error instanceof Error ? error.message : "Database health check failed"],
    };
  }
}
