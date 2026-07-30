import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events, venueCameras, venueImages, venueMembers, venues } from "@/db/schema";

type CurrentOwnerMembership = {
  venueId: number;
  role: "owner" | "manager";
  venue: typeof venues.$inferSelect;
  clerkUserId: string;
};

export async function getCurrentOwnerVenueOptional(): Promise<CurrentOwnerMembership | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const [membership] = await db
    .select({
      venueId: venues.id,
      role: venueMembers.role,
      venue: venues,
    })
    .from(venueMembers)
    .innerJoin(venues, eq(venueMembers.venueId, venues.id))
    .where(eq(venueMembers.clerkUserId, clerkUserId))
    .limit(1);

  if (!membership?.venue) {
    return null;
  }

  return {
    venueId: membership.venueId,
    role: membership.role,
    venue: membership.venue,
    clerkUserId,
  };
}

export async function getCurrentOwnerVenue() {
  const membership = await getCurrentOwnerVenueOptional();

  if (!membership) {
    throw new Error("Forbidden. You do not have venue access.");
  }

  return membership;
}

export async function assertCurrentOwnerVenueId(venueId: number) {
  const { venueId: expectedVenueId } = await getCurrentOwnerVenue();

  if (venueId !== expectedVenueId) {
    throw new Error("Unauthorized venue access.");
  }

  return venueId;
}

export async function ensureImageOwnedByCurrentOwner(imageId: number) {
  const [image] = await db
    .select({ id: venueImages.id, venueId: venueImages.venueId, sortOrder: venueImages.sortOrder })
    .from(venueImages)
    .where(eq(venueImages.id, imageId))
    .limit(1);

  if (!image) {
    throw new Error("Image not found.");
  }

  await assertCurrentOwnerVenueId(image.venueId);

  return image;
}

export async function ensureEventOwnedByCurrentOwner(eventId: number) {
  const [event] = await db
    .select({ id: events.id, venueId: events.venueId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw new Error("Event not found.");
  }

  await assertCurrentOwnerVenueId(event.venueId);

  return event;
}

export async function ensureCameraOwnedByCurrentOwner(cameraId: number) {
  const [camera] = await db
    .select({ id: venueCameras.id, venueId: venueCameras.venueId, isPrimary: venueCameras.isPrimary })
    .from(venueCameras)
    .where(eq(venueCameras.id, cameraId))
    .limit(1);

  if (!camera) {
    throw new Error("Camera not found.");
  }

  await assertCurrentOwnerVenueId(camera.venueId);

  return camera;
}
