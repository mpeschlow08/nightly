import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { venues } from "@/db/schema";

import { assertMockOwnerVenueId } from "./ownership";

function parseAuthorizedOwnerUserIds() {
  const raw = process.env.OWNER_PORTAL_AUTHORIZED_USER_IDS ?? "";

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export async function requireAuthorizedOwnerForVenue(venueId: number) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized. Please sign in.");
  }

  const authorizedUserIds = parseAuthorizedOwnerUserIds();

  if (authorizedUserIds.length === 0) {
    throw new Error(
      "Owner authorization is not configured. Set OWNER_PORTAL_AUTHORIZED_USER_IDS."
    );
  }

  if (!authorizedUserIds.includes(userId)) {
    throw new Error("Forbidden. You are not authorized to manage this venue.");
  }

  const ownedVenueId = assertMockOwnerVenueId(venueId);
  const [venue] = await db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      latitude: venues.latitude,
      longitude: venues.longitude,
      address: venues.address,
      phone: venues.phone,
      websiteUrl: venues.websiteUrl,
      googleMapsUrl: venues.googleMapsUrl,
      openingHoursJson: venues.openingHoursJson,
      googlePlaceId: venues.googlePlaceId,
    })
    .from(venues)
    .where(eq(venues.id, ownedVenueId))
    .limit(1);

  if (!venue) {
    throw new Error("Venue not found.");
  }

  return { userId, venueId: ownedVenueId, venue };
}
