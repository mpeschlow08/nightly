import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events, venueImages } from "@/db/schema";

import { getMockOwnerVenueId } from "./mock-owner";

export function assertMockOwnerVenueId(venueId: number) {
  const expectedVenueId = getMockOwnerVenueId();

  if (venueId !== expectedVenueId) {
    throw new Error("Unauthorized venue access.");
  }

  return venueId;
}

export async function ensureImageOwnedByMockOwner(imageId: number) {
  const [image] = await db
    .select({ id: venueImages.id, venueId: venueImages.venueId, sortOrder: venueImages.sortOrder })
    .from(venueImages)
    .where(eq(venueImages.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found.");
  }

  assertMockOwnerVenueId(image.venueId);

  return image;
}

export async function ensureEventOwnedByMockOwner(eventId: number) {
  const [event] = await db
    .select({ id: events.id, venueId: events.venueId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw new Error("Event not found.");
  }

  assertMockOwnerVenueId(event.venueId);

  return event;
}
