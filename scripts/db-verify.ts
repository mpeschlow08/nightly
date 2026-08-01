import { readFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

function getJournalEntries() {
  const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
  const raw = readFileSync(journalPath, "utf8");
  const parsed = JSON.parse(raw) as {
    entries: Array<{ idx: number; tag: string; when: number }>;
  };

  return parsed.entries.sort((a, b) => a.idx - b.idx);
}

async function main() {
  const { db } = await import("../db");
  const entries = getJournalEntries();

  const [ledgerRows, tableRows] = await Promise.all([
    db.execute<{ count: string }>(sql`select count(*)::text as count from drizzle.__drizzle_migrations`),
    db.execute<{ table_count: string }>(sql`select count(*)::text as table_count from information_schema.tables where table_schema='public'`),
  ]);

  const applied = Number.parseInt(ledgerRows.rows[0]?.count ?? "0", 10);
  const journalCount = entries.length;
  const pending = Math.max(0, journalCount - applied);
  const pendingTags = entries.slice(applied).map((entry) => entry.tag);

  const result = {
    journalMigrationCount: journalCount,
    appliedMigrationCount: applied,
    pendingMigrationCount: pending,
    pendingMigrationTags: pendingTags,
    schemaTableCount: Number.parseInt(tableRows.rows[0]?.table_count ?? "0", 10),
    isDriftDetected: pending > 0,
    latestJournalMigration: entries[entries.length - 1]?.tag ?? null,
  };

  console.log(JSON.stringify(result, null, 2));

  if (result.isDriftDetected) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db-verify failed");
  process.exitCode = 1;
});
