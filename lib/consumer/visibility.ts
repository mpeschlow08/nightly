import type { InferSelectModel } from "drizzle-orm";

import { events, venues } from "@/db/schema";

export type VenueRow = InferSelectModel<typeof venues>;
export type EventRow = InferSelectModel<typeof events>;

export function isVenuePublic(venue: VenueRow) {
  const published = venue.publicationStatus === "published" || venue.publicationStatus === "approved";
  const hasName = venue.name.trim().length > 0;
  const hasLocation =
    (typeof venue.latitude === "number" && Number.isFinite(venue.latitude)) ||
    (typeof venue.longitude === "number" && Number.isFinite(venue.longitude)) ||
    Boolean(venue.city?.trim());
  const notArchived = !venue.archivedAt;
  const notSuspended = !venue.suspendedAt;

  return published && hasName && hasLocation && notArchived && notSuspended;
}

export function isEventPublic(event: EventRow, venue: VenueRow, now: Date) {
  const published =
    event.isPublished ||
    event.publicationStatus === "published" ||
    event.publicationStatus === "approved";
  const attachedToPublicVenue = isVenuePublic(venue);
  const notCanceled = !event.isCanceled;
  const notArchived = !event.isArchived;
  const notPast = (event.endsAt ?? event.startsAt) >= new Date(now.getTime() - 12 * 60 * 60 * 1000);

  return published && attachedToPublicVenue && notCanceled && notArchived && notPast;
}
