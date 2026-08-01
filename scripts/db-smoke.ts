import { config } from "dotenv";

import { sql } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db");
  const { events, users, venues } = await import("../db/schema");
  const [dbPing, usersCount, venuesCount, eventsCount] = await Promise.all([
    db.execute(sql`select now() as now`),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(venues),
    db.select({ count: sql<number>`count(*)::int` }).from(events),
  ]);

  const result = {
    ok: true,
    now: dbPing.rows[0]?.now ?? null,
    usersCount: usersCount[0]?.count ?? 0,
    venuesCount: venuesCount[0]?.count ?? 0,
    eventsCount: eventsCount[0]?.count ?? 0,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db-smoke failed");
  process.exitCode = 1;
});
