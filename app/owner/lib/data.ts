import { and, asc, eq, gte, sql } from "drizzle-orm";

import { getVenueById, getVenueBusinessHours, getVenueImages, normalizeBusinessHours } from "@/app/api/venues/lib/venues";
import { db } from "@/db";
import { events } from "@/db/schema";

import { isTableMissingError } from "./events-support";
import { getMockOwnerVenueId } from "./mock-owner";

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
  coverCents: number;
  genre: string | null;
  dressCode: string | null;
  isFeatured: boolean;
  is21Plus: boolean;
  createdAt: Date;
};

export async function getOwnerVenue() {
  const venueId = getMockOwnerVenueId();
  const venue = await getVenueById(venueId);

  return { venueId, venue };
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
