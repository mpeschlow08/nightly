import { config } from "dotenv";
import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const [{ db }, { venues }] = await Promise.all([import("@/db"), import("@/db/schema")]);

  const [totalRow, withPlaceIdRow, withoutPlaceIdRow, staleRow, failedRow, duplicateRows] =
    await Promise.all([
      db.select({ value: count() }).from(venues),
      db
        .select({ value: count() })
        .from(venues)
        .where(isNotNull(venues.googlePlaceId)),
      db
        .select({ value: count() })
        .from(venues)
        .where(isNull(venues.googlePlaceId)),
      db
        .select({ value: count() })
        .from(venues)
        .where(
          and(
            isNotNull(venues.googlePlaceId),
            sql`${venues.googleDataExpiresAt} is null or ${venues.googleDataExpiresAt} <= now()`
          )
        ),
      db
        .select({ value: count() })
        .from(venues)
        .where(isNotNull(venues.googleRefreshError)),
      db.execute<{
        google_place_id: string;
        venue_count: string;
      }>(sql`
        select google_place_id, count(*)::text as venue_count
        from venues
        where google_place_id is not null
        group by google_place_id
        having count(*) > 1
        order by count(*) desc
        limit 100
      `),
    ]);

  const result = {
    totalVenues: totalRow[0]?.value ?? 0,
    withGooglePlaceId: withPlaceIdRow[0]?.value ?? 0,
    withoutGooglePlaceId: withoutPlaceIdRow[0]?.value ?? 0,
    staleGoogleRecords: staleRow[0]?.value ?? 0,
    failedGoogleRefreshRecords: failedRow[0]?.value ?? 0,
    duplicatePlaceIds: duplicateRows.rows,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "venues-google-audit failed");
  process.exitCode = 1;
});
