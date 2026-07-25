"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { head } from "@vercel/blob";

import { db } from "@/db";
import { events, venueBusinessHours, venueImages, venues } from "@/db/schema";

import { isTableMissingError } from "./lib/events-support";
import {
  assertMockOwnerVenueId,
  ensureEventOwnedByMockOwner,
  ensureImageOwnedByMockOwner,
} from "./lib/ownership";

function asNonEmptyString(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function asOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}

function asInt(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function asDateTimeLocal(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    throw new Error(`${label} is required.`);
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  return parsed;
}

function asDateInput(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${label} must be a valid date.`);
  }

  return raw;
}

function asRequiredTimeInput(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    throw new Error(`${label} is required.`);
  }

  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`${label} must be a valid time.`);
  }

  return raw;
}

function asOptionalTimeInputEvent(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`${label} must be a valid time.`);
  }

  return raw;
}

function composeDateTime(dateInput: string, timeInput: string, label: string) {
  const composed = new Date(`${dateInput}T${timeInput}`);

  if (Number.isNaN(composed.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return composed;
}

function asOptionalDateTimeLocal(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  return parsed;
}

function asCurrencyCents(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  return Math.round(parsed * 100);
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function asOptionalTimeInput(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`${label} must be a valid time.`);
  }

  return raw;
}

function timeToMinutes(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function normalizeCrowdLevel(value: FormDataEntryValue | null) {
  const allowed = new Set(["Low", "Mellow", "Moderate", "Busy", "Packed"]);
  const text = typeof value === "string" ? value.trim() : "";

  if (!allowed.has(text)) {
    throw new Error("Crowd level must be one of: Low, Mellow, Moderate, Busy, Packed.");
  }

  return text;
}

function normalizeGenre(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? [text] : null;
}

function normalizeHttpUrl(value: FormDataEntryValue | null) {
  const raw = asNonEmptyString(value, "Image URL");

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Image URL must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Image URL must start with http:// or https://.");
  }

  return parsed.toString();
}

function asValidBlobVenueImageUrl(value: string, venueId: number) {
  const raw = value.trim();

  if (!raw) {
    throw new Error("Blob URL is required.");
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Blob URL must be a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Blob URL must use https.");
  }

  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    throw new Error("Blob URL must be a Vercel Blob URL.");
  }

  const expectedPrefix = `/venue-images/${venueId}/`;

  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error("Blob URL path is invalid for this venue.");
  }

  return parsed.toString();
}

function mutationErrorPath(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const query = new URLSearchParams({ error: message });

  return `${path}?${query.toString()}`;
}

function mutationSuccessPath(path: string, success: string) {
  const query = new URLSearchParams({ success });

  return `${path}?${query.toString()}`;
}

const ALLOWED_OWNER_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_OWNER_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

async function normalizeImageSortOrder(venueId: number) {
  const images = await db
    .select({ id: venueImages.id })
    .from(venueImages)
    .where(eq(venueImages.venueId, venueId))
    .orderBy(asc(venueImages.sortOrder), asc(venueImages.id));

  await Promise.all(
    images.map((image, index) =>
      db.update(venueImages).set({ sortOrder: index }).where(eq(venueImages.id, image.id))
    )
  );
}

function revalidateOwnerAndVenue(venueId: number) {
  revalidatePath("/owner");
  revalidatePath("/owner/venue");
  revalidatePath("/owner/images");
  revalidatePath("/owner/events");
  revalidatePath(`/venues/${venueId}`);
}

function revalidateEventsConsumers(venueId: number) {
  revalidatePath("/");
  revalidatePath(`/venues/${venueId}`);
}

function revalidateHoursConsumers(venueId: number) {
  revalidatePath("/owner");
  revalidatePath("/owner/hours");
  revalidatePath(`/venues/${venueId}`);
}

export async function updateOwnerVenueHoursAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    assertMockOwnerVenueId(venueId);

    const hoursRows: Array<{
      venueId: number;
      dayOfWeek: number;
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }> = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const isClosed = asBoolean(formData.get(`closed-${dayOfWeek}`));
      const openTime = asOptionalTimeInput(formData.get(`open-${dayOfWeek}`), "Open time");
      const closeTime = asOptionalTimeInput(formData.get(`close-${dayOfWeek}`), "Close time");

      if (!isClosed && (!openTime || !closeTime)) {
        throw new Error("Open and close times are required for days that are not marked closed.");
      }

      if (!isClosed && openTime && closeTime) {
        const openMinutes = timeToMinutes(openTime);
        const closeMinutes = timeToMinutes(closeTime);

        if (openMinutes == null || closeMinutes == null) {
          throw new Error("Business hours contain an invalid time value.");
        }

        if (closeMinutes <= openMinutes) {
          throw new Error("Close time must be later than open time for the same day.");
        }
      }

      hoursRows.push({
        venueId,
        dayOfWeek,
        openTime: isClosed ? null : openTime,
        closeTime: isClosed ? null : closeTime,
        isClosed,
      });
    }

    await db.delete(venueBusinessHours).where(eq(venueBusinessHours.venueId, venueId));
    await db.insert(venueBusinessHours).values(hoursRows);

    revalidateHoursConsumers(venueId);
    redirect(mutationSuccessPath("/owner/hours", "Business hours saved."));
  } catch (error) {
    if (isTableMissingError(error)) {
      redirect(
        mutationErrorPath(
          "/owner/hours",
          new Error("Business hours table is unavailable. Run the next migration before managing hours.")
        )
      );
    }

    redirect(mutationErrorPath("/owner/hours", error));
  }
}

export async function updateOwnerVenueAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    assertMockOwnerVenueId(venueId);

    const name = asNonEmptyString(formData.get("name"), "Venue name");
    const tagline = asOptionalString(formData.get("tagline"));
    const city = asOptionalString(formData.get("city"));
    const genres = normalizeGenre(formData.get("genre"));
    const crowdLevel = normalizeCrowdLevel(formData.get("crowdLevel"));
    const isLive = asBoolean(formData.get("isLive"));

    await db
      .update(venues)
      .set({
        name,
        tagline,
        city,
        genres,
        crowdLevel,
        isLive,
      })
      .where(eq(venues.id, venueId));

    revalidateOwnerAndVenue(venueId);
    redirect(mutationSuccessPath("/owner/venue", "Venue saved."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/venue", error));
  }
}

export async function addOwnerVenueImageAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    assertMockOwnerVenueId(venueId);

    const imageUrl = normalizeHttpUrl(formData.get("imageUrl"));

    const [maxResult] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${venueImages.sortOrder}), -1)` })
      .from(venueImages)
      .where(eq(venueImages.venueId, venueId));

    const nextSortOrder = (maxResult?.maxOrder ?? -1) + 1;

    await db.insert(venueImages).values({
      venueId,
      imageUrl,
      sortOrder: nextSortOrder,
    });

    revalidateOwnerAndVenue(venueId);
    redirect(mutationSuccessPath("/owner/images", "Image added."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/images", error));
  }
}

export type AddOwnerVenueImageFromBlobActionResult =
  | { success: true }
  | { success: false; error: string };

type AddOwnerVenueImageFromBlobActionInput = {
  venueId: number;
  blobUrl: string;
};

export async function addOwnerVenueImageFromBlobAction(
  input: AddOwnerVenueImageFromBlobActionInput
): Promise<AddOwnerVenueImageFromBlobActionResult> {
  try {
    if (!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim()) {
      throw new Error("Blob upload token is not configured.");
    }

    if (!Number.isInteger(input.venueId)) {
      throw new Error("Venue ID must be a valid number.");
    }

    const venueId = assertMockOwnerVenueId(input.venueId);
    const blobUrl = asValidBlobVenueImageUrl(input.blobUrl, venueId);
    const blob = await head(blobUrl, { token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN });
    const expectedPathPrefix = `venue-images/${venueId}/`;

    if (!blob.pathname.startsWith(expectedPathPrefix)) {
      throw new Error("Uploaded image path is invalid for this venue.");
    }

    if (!ALLOWED_OWNER_IMAGE_CONTENT_TYPES.has(blob.contentType)) {
      throw new Error("Uploaded image type is not supported.");
    }

    if (blob.size > MAX_OWNER_IMAGE_SIZE_BYTES) {
      throw new Error("Uploaded image must be 10 MB or smaller.");
    }

    const [maxResult] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${venueImages.sortOrder}), -1)` })
      .from(venueImages)
      .where(eq(venueImages.venueId, venueId));

    const nextSortOrder = (maxResult?.maxOrder ?? -1) + 1;

    await db.insert(venueImages).values({
      venueId,
      imageUrl: blob.url,
      sortOrder: nextSortOrder,
    });

    revalidateOwnerAndVenue(venueId);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload persistence failed.";
    return { success: false, error: message };
  }
}

export async function deleteOwnerVenueImageAction(formData: FormData) {
  try {
    const imageId = asInt(formData.get("imageId"), "Image ID");
    const image = await ensureImageOwnedByMockOwner(imageId);

    await db.delete(venueImages).where(eq(venueImages.id, imageId));
    await normalizeImageSortOrder(image.venueId);

    revalidateOwnerAndVenue(image.venueId);
    redirect(mutationSuccessPath("/owner/images", "Image deleted."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/images", error));
  }
}

export async function moveOwnerVenueImageAction(formData: FormData) {
  try {
    const imageId = asInt(formData.get("imageId"), "Image ID");
    const direction = asNonEmptyString(formData.get("direction"), "Direction");
    const image = await ensureImageOwnedByMockOwner(imageId);

    const images = await db
      .select({ id: venueImages.id, sortOrder: venueImages.sortOrder })
      .from(venueImages)
      .where(eq(venueImages.venueId, image.venueId))
      .orderBy(asc(venueImages.sortOrder), asc(venueImages.id));

    const currentIndex = images.findIndex((item) => item.id === imageId);

    if (currentIndex === -1) {
      throw new Error("Image not found in ordering.");
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= images.length) {
      redirect(mutationSuccessPath("/owner/images", "Image order unchanged."));
    }

    const current = images[currentIndex];
    const target = images[targetIndex];

    await db.update(venueImages).set({ sortOrder: target.sortOrder }).where(eq(venueImages.id, current.id));
    await db.update(venueImages).set({ sortOrder: current.sortOrder }).where(eq(venueImages.id, target.id));
    await normalizeImageSortOrder(image.venueId);

    revalidateOwnerAndVenue(image.venueId);
    redirect(mutationSuccessPath("/owner/images", "Image order updated."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/images", error));
  }
}

export async function setOwnerVenueCoverImageAction(formData: FormData) {
  let successMessage = "Cover photo updated.";

  try {
    const imageId = asInt(formData.get("imageId"), "Image ID");
    const image = await ensureImageOwnedByMockOwner(imageId);

    const images = await db
      .select({ id: venueImages.id, sortOrder: venueImages.sortOrder })
      .from(venueImages)
      .where(eq(venueImages.venueId, image.venueId))
      .orderBy(asc(venueImages.sortOrder), asc(venueImages.id));

    const selected = images.find((item) => item.id === imageId);

    if (!selected) {
      throw new Error("Image not found in ordering.");
    }

    if (selected.sortOrder === 0) {
      successMessage = "Image is already the cover photo.";
    } else {
      await db.update(venueImages).set({ sortOrder: -1 }).where(eq(venueImages.id, imageId));
      await normalizeImageSortOrder(image.venueId);

      revalidateOwnerAndVenue(image.venueId);
    }
  } catch (error) {
    redirect(mutationErrorPath("/owner/images", error));
  }

  redirect(mutationSuccessPath("/owner/images", successMessage));
}

export async function createOwnerEventAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    assertMockOwnerVenueId(venueId);

    const title = asNonEmptyString(formData.get("title"), "Title");
    const description = asOptionalString(formData.get("description"));
    const date = asDateInput(formData.get("date"), "Date");
    const startTime = asRequiredTimeInput(formData.get("startTime"), "Start time");
    const endTime = asOptionalTimeInputEvent(formData.get("endTime"), "End time");
    const eventDate = composeDateTime(date, startTime, "Date");
    const startsAt = composeDateTime(date, startTime, "Start time");
    const endsAt = endTime ? composeDateTime(date, endTime, "End time") : null;
    const coverCents = asCurrencyCents(formData.get("coverDollars"), "Cover price");
    const genre = asOptionalString(formData.get("genre"));
    const dressCode = asOptionalString(formData.get("dressCode"));
    const isFeatured = asBoolean(formData.get("isFeatured"));
    const is21Plus = asBoolean(formData.get("is21Plus"));

    if (endsAt && endsAt <= startsAt) {
      throw new Error("End time must be later than start time.");
    }

    await db.insert(events).values({
      venueId,
      title,
      description,
      eventDate,
      startTime,
      endTime,
      startsAt,
      endsAt,
      coverCents,
      genre,
      dressCode,
      isFeatured,
      is21Plus,
    });

    revalidateOwnerAndVenue(venueId);
    revalidateEventsConsumers(venueId);
    redirect(mutationSuccessPath("/owner/events", "Event created."));
  } catch (error) {
    if (isTableMissingError(error)) {
      redirect(
        mutationErrorPath(
          "/owner/events",
          new Error("Events table is unavailable. Run the next migration before managing events.")
        )
      );
    }

    redirect(mutationErrorPath("/owner/events", error));
  }
}

export async function updateOwnerEventAction(formData: FormData) {
  try {
    const eventId = asInt(formData.get("eventId"), "Event ID");
    const event = await ensureEventOwnedByMockOwner(eventId);

    const title = asNonEmptyString(formData.get("title"), "Title");
    const description = asOptionalString(formData.get("description"));
    const date = asDateInput(formData.get("date"), "Date");
    const startTime = asRequiredTimeInput(formData.get("startTime"), "Start time");
    const endTime = asOptionalTimeInputEvent(formData.get("endTime"), "End time");
    const eventDate = composeDateTime(date, startTime, "Date");
    const startsAt = composeDateTime(date, startTime, "Start time");
    const endsAt = endTime ? composeDateTime(date, endTime, "End time") : null;
    const coverCents = asCurrencyCents(formData.get("coverDollars"), "Cover price");
    const genre = asOptionalString(formData.get("genre"));
    const dressCode = asOptionalString(formData.get("dressCode"));
    const isFeatured = asBoolean(formData.get("isFeatured"));
    const is21Plus = asBoolean(formData.get("is21Plus"));

    if (endsAt && endsAt <= startsAt) {
      throw new Error("End time must be later than start time.");
    }

    await db
      .update(events)
      .set({
        title,
        description,
        eventDate,
        startTime,
        endTime,
        startsAt,
        endsAt,
        coverCents,
        genre,
        dressCode,
        isFeatured,
        is21Plus,
      })
      .where(eq(events.id, eventId));

    revalidateOwnerAndVenue(event.venueId);
    revalidateEventsConsumers(event.venueId);
    redirect(mutationSuccessPath("/owner/events", "Event updated."));
  } catch (error) {
    if (isTableMissingError(error)) {
      redirect(
        mutationErrorPath(
          "/owner/events",
          new Error("Events table is unavailable. Run the next migration before managing events.")
        )
      );
    }

    redirect(mutationErrorPath("/owner/events", error));
  }
}

export async function deleteOwnerEventAction(formData: FormData) {
  try {
    const eventId = asInt(formData.get("eventId"), "Event ID");
    const confirmDelete = asNonEmptyString(formData.get("confirmDelete"), "Delete confirmation");

    if (confirmDelete !== "yes") {
      throw new Error("Please confirm deletion before removing an event.");
    }

    const event = await ensureEventOwnedByMockOwner(eventId);

    await db.delete(events).where(eq(events.id, eventId));

    revalidateOwnerAndVenue(event.venueId);
    revalidateEventsConsumers(event.venueId);
    redirect(mutationSuccessPath("/owner/events", "Event deleted."));
  } catch (error) {
    if (isTableMissingError(error)) {
      redirect(
        mutationErrorPath(
          "/owner/events",
          new Error("Events table is unavailable. Run the next migration before managing events.")
        )
      );
    }

    redirect(mutationErrorPath("/owner/events", error));
  }
}
