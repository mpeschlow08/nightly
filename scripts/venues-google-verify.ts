import { config } from "dotenv";
import { and, isNotNull } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const [{ db }, { venues, venueGooglePhotoMetadata }] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
  ]);

  const linkedVenues = await db
    .select({
      id: venues.id,
      name: venues.name,
      googlePlaceId: venues.googlePlaceId,
      googleDataLastFetchedAt: venues.googleDataLastFetchedAt,
      googleRefreshStatus: venues.googleRefreshStatus,
      googleAttributionsJson: venues.googleAttributionsJson,
      googlePhotoReferencesJson: venues.googlePhotoReferencesJson,
    })
    .from(venues)
    .where(isNotNull(venues.googlePlaceId));

  const photoRows = await db
    .select({ venueId: venueGooglePhotoMetadata.venueId })
    .from(venueGooglePhotoMetadata);

  const photoCountByVenue = new Map<number, number>();
  for (const row of photoRows) {
    photoCountByVenue.set(row.venueId, (photoCountByVenue.get(row.venueId) ?? 0) + 1);
  }

  const missingAttribution = linkedVenues.filter((venue) => {
    if (!venue.googlePhotoReferencesJson) {
      return false;
    }

    return !venue.googleAttributionsJson || venue.googleAttributionsJson.trim() === "[]";
  });

  const staleOrNever = linkedVenues.filter(
    (venue) => !venue.googleDataLastFetchedAt || venue.googleRefreshStatus !== "success"
  );

  const noPhotoMetadata = linkedVenues.filter((venue) => (photoCountByVenue.get(venue.id) ?? 0) === 0);

  console.log(
    JSON.stringify(
      {
        linkedVenueCount: linkedVenues.length,
        missingAttributionCount: missingAttribution.length,
        staleOrNonSuccessCount: staleOrNever.length,
        noPhotoMetadataCount: noPhotoMetadata.length,
        missingAttributionVenueIds: missingAttribution.map((venue) => venue.id),
        staleOrNonSuccessVenueIds: staleOrNever.map((venue) => venue.id),
        noPhotoMetadataVenueIds: noPhotoMetadata.map((venue) => venue.id),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "venues-google-verify failed");
  process.exitCode = 1;
});
