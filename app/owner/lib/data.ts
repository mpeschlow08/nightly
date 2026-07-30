import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { getVenueBusinessHours, getVenueImages, normalizeBusinessHours } from "@/app/api/venues/lib/venues";
import { db } from "@/db";
import { events, venueCameras, venueImages } from "@/db/schema";

import { isTableMissingError } from "./events-support";
import { getCurrentOwnerVenue } from "./ownership";

export type OwnerEventRecord = {
  id: number;
  venueId: number;
  title: string;
  description: string | null;
  eventDate: Date;
  startTime: string;
  endTime: string | null;
  startsAt: Date;
  endsAt: Date | null;
  coverImageUrl: string | null;
  ticketUrl: string | null;
  guestListUrl: string | null;
  reservationUrl: string | null;
  eventType: "event" | "special" | "guest_list" | "reservation";
  recurrenceRule: string | null;
  specialDetails: string | null;
  coverCents: number;
  ageRequirement: number | null;
  genre: string | null;
  dressCode: string | null;
  isFeatured: boolean;
  is21Plus: boolean;
  isPublished: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  publicationStatus: string;
  createdAt: Date;
};

export async function getOwnerVenue() {
  const { venueId, venue, role } = await getCurrentOwnerVenue();

  return { venueId, venue, role };
}

export async function getOwnerVenueImages() {
  const { venueId } = await getOwnerVenue();
  const images = await getVenueImages(venueId);

  return images;
}

export async function getOwnerVenueBusinessHours() {
  const { venueId } = await getOwnerVenue();

  try {
    const rows = await getVenueBusinessHours(venueId);

    return { hours: normalizeBusinessHours(rows), unavailable: false };
  } catch (error) {
    if (isTableMissingError(error)) {
      return { hours: normalizeBusinessHours([]), unavailable: true };
    }

    throw error;
  }
}

export async function getOwnerUpcomingEventCount() {
  const { venueId } = await getOwnerVenue();

  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.venueId, venueId), gte(events.startsAt, new Date())));

    return { count: result?.count ?? 0, unavailable: false };
  } catch (error) {
    if (isTableMissingError(error)) {
      return { count: 0, unavailable: true };
    }

    throw error;
  }
}

export async function getOwnerEvents() {
  const { venueId } = await getOwnerVenue();

  try {
    const eventRows = await db
      .select()
      .from(events)
      .where(eq(events.venueId, venueId))
      .orderBy(asc(events.startsAt));

    return { events: eventRows as OwnerEventRecord[], unavailable: false };
  } catch (error) {
    if (isTableMissingError(error)) {
      return { events: [] as OwnerEventRecord[], unavailable: true };
    }

    throw error;
  }
}

export type OwnerCameraRecord = {
  id: number;
  venueId: number;
  name: string;
  streamUrl: string;
  streamType: string;
  status: string;
  isPrimary: boolean;
  createdAt: Date;
};

export async function getOwnerCameras() {
  const { venueId } = await getOwnerVenue();

  try {
    const cameras = await db
      .select()
      .from(venueCameras)
      .where(eq(venueCameras.venueId, venueId))
      .orderBy(desc(venueCameras.isPrimary), asc(venueCameras.createdAt));

    return { cameras: cameras as OwnerCameraRecord[], unavailable: false };
  } catch (error) {
    if (isTableMissingError(error)) {
      return { cameras: [] as OwnerCameraRecord[], unavailable: true };
    }

    throw error;
  }
}

export type OwnerRecentActivityRecord = {
  type: "event" | "image" | "camera";
  title: string;
  createdAt: Date;
};

export async function getOwnerRecentActivity(limit = 6) {
  const { venueId } = await getOwnerVenue();

  const [recentEvents, recentImages, recentCameras] = await Promise.all([
    db
      .select({ title: events.title, createdAt: events.createdAt })
      .from(events)
      .where(eq(events.venueId, venueId))
      .orderBy(desc(events.createdAt))
      .limit(limit),
    db
      .select({ id: venueImages.id, caption: venueImages.caption, createdAt: venueImages.createdAt })
      .from(venueImages)
      .where(eq(venueImages.venueId, venueId))
      .orderBy(desc(venueImages.createdAt))
      .limit(limit),
    db
      .select({ name: venueCameras.name, createdAt: venueCameras.createdAt })
      .from(venueCameras)
      .where(eq(venueCameras.venueId, venueId))
      .orderBy(desc(venueCameras.createdAt))
      .limit(limit),
  ]);

  const merged: OwnerRecentActivityRecord[] = [
    ...recentEvents.map((event) => ({
      type: "event" as const,
      title: `Event created: ${event.title}`,
      createdAt: event.createdAt,
    })),
    ...recentImages.map((image) => ({
      type: "image" as const,
      title: `Gallery image added${image.caption ? `: ${image.caption}` : ""}`,
      createdAt: image.createdAt,
    })),
    ...recentCameras.map((camera) => ({
      type: "camera" as const,
      title: `Camera added: ${camera.name}`,
      createdAt: camera.createdAt,
    })),
  ];

  return merged
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
