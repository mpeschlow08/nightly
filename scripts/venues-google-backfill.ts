import { config } from "dotenv";
import { and, asc, isNull } from "drizzle-orm";

config({ path: ".env.local" });

type Candidate = {
  venueId: number;
  venueName: string;
  city: string | null;
  placeCandidates: Array<{
    placeId: string;
    displayName: string;
    formattedAddress: string;
    city: string | null;
  }>;
};

async function main() {
  const { searchGooglePlacesVenues } = await import("@/app/owner/lib/google-places");
  const [{ db }, { venues }] = await Promise.all([import("@/db"), import("@/db/schema")]);

  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 15;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 15;

  const rows = await db
    .select({ id: venues.id, name: venues.name, city: venues.city, latitude: venues.latitude, longitude: venues.longitude })
    .from(venues)
    .where(and(isNull(venues.googlePlaceId), isNull(venues.archivedAt)))
    .orderBy(asc(venues.id))
    .limit(safeLimit);

  const candidates: Candidate[] = [];

  for (const row of rows) {
    try {
      const placeResults = await searchGooglePlacesVenues({
        query: row.name,
        venueCity: row.city,
        venueLatitude: row.latitude,
        venueLongitude: row.longitude,
      });

      candidates.push({
        venueId: row.id,
        venueName: row.name,
        city: row.city,
        placeCandidates: placeResults.slice(0, 5).map((place) => ({
          placeId: place.placeId,
          displayName: place.displayName,
          formattedAddress: place.formattedAddress,
          city: place.city,
        })),
      });
    } catch {
      candidates.push({
        venueId: row.id,
        venueName: row.name,
        city: row.city,
        placeCandidates: [],
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        notes:
          "This command only proposes candidates. Owner or admin confirmation is required before linking place IDs.",
        candidates,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "venues-google-backfill failed");
  process.exitCode = 1;
});
