"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { head } from "@vercel/blob";

import { db } from "@/db";
import { events, venueBusinessHours, venueCameras, venueImages, venues } from "@/db/schema";

import { requireAuthorizedOwnerForVenue } from "./lib/authorization";
import { isTableMissingError } from "./lib/events-support";
import { getGooglePlaceVenueDetails } from "./lib/google-places";
import { refreshVenueImagesForVenue } from "./lib/venue-image-import";
import {
  assertCurrentOwnerVenueId,
  ensureCameraOwnedByCurrentOwner,
  ensureEventOwnedByCurrentOwner,
  ensureImageOwnedByCurrentOwner,
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

function asOptionalFloat(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function asOptionalHttpUrl(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must start with http:// or https://.`);
  }

  return parsed.toString();
}

function asOptionalJsonString(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }

  return text;
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

function toTimeText(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function asCurrencyCents(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  return Math.round(parsed * 100);
}

function asOptionalBoundedInt(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number
) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return parsed;
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

  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

function moderationRequiredForEvents() {
  return process.env.EVENT_APPROVAL_REQUIRED === "true";
}

function normalizeEventType(
  value: FormDataEntryValue | null
): "event" | "special" | "guest_list" | "reservation" {
  const text = asNonEmptyString(value, "Event type").toLowerCase();
  const allowed = new Set(["event", "special", "guest_list", "reservation"]);

  if (!allowed.has(text)) {
    throw new Error("Event type must be event, special, guest_list, or reservation.");
  }

  return text as "event" | "special" | "guest_list" | "reservation";
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

function asValidBlobVenueAssetUrl(value: string, expectedPrefix: string) {
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
const MAX_OWNER_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

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
  revalidatePath("/owner/cameras");
  revalidatePath(`/venues/${venueId}`);
  revalidateTag("consumer:venues", "max");
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
}

function revalidateEventsConsumers(venueId: number) {
  revalidatePath("/");
  revalidatePath(`/venues/${venueId}`);
  revalidateTag("consumer:events", "max");
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
}

function revalidateHoursConsumers(venueId: number) {
  revalidatePath("/owner");
  revalidatePath("/owner/hours");
  revalidatePath(`/venues/${venueId}`);
  revalidateTag("consumer:venues", "max");
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
}

function hasNonEmptyValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
}

export async function updateOwnerVenueHoursAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

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

export async function copyMondayHoursToWeekdaysAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

    const mondayClosed = asBoolean(formData.get("closed-1"));
    const mondayOpen = asOptionalTimeInput(formData.get("open-1"), "Monday open time");
    const mondayClose = asOptionalTimeInput(formData.get("close-1"), "Monday close time");

    if (!mondayClosed && (!mondayOpen || !mondayClose)) {
      throw new Error("Set Monday open/close times before copying to weekdays.");
    }

    const nextRows: Array<{
      venueId: number;
      dayOfWeek: number;
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }> = [];

    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
      nextRows.push({
        venueId,
        dayOfWeek,
        openTime: mondayClosed ? null : mondayOpen,
        closeTime: mondayClosed ? null : mondayClose,
        isClosed: mondayClosed,
      });
    }

    await db.delete(venueBusinessHours).where(eq(venueBusinessHours.venueId, venueId));

    const existingRows: Array<{
      venueId: number;
      dayOfWeek: number;
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }> = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const weekdayOverride = nextRows.find((row) => row.dayOfWeek === dayOfWeek);

      if (weekdayOverride) {
        existingRows.push(weekdayOverride);
        continue;
      }

      const isClosed = asBoolean(formData.get(`closed-${dayOfWeek}`));
      const openTime = asOptionalTimeInput(formData.get(`open-${dayOfWeek}`), "Open time");
      const closeTime = asOptionalTimeInput(formData.get(`close-${dayOfWeek}`), "Close time");

      existingRows.push({
        venueId,
        dayOfWeek,
        openTime: isClosed ? null : openTime,
        closeTime: isClosed ? null : closeTime,
        isClosed,
      });
    }

    await db.insert(venueBusinessHours).values(existingRows);

    revalidateHoursConsumers(venueId);
    redirect(mutationSuccessPath("/owner/hours", "Copied Monday hours to weekdays."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/hours", error));
  }
}

export async function updateOwnerVenueAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

    const name = asNonEmptyString(formData.get("name"), "Venue name");
    const description = asOptionalString(formData.get("description"));
    const tagline = asOptionalString(formData.get("tagline"));
    const city = asOptionalString(formData.get("city"));
    const genres = normalizeGenre(formData.get("genres"));
    const crowdLevel = normalizeCrowdLevel(formData.get("crowdLevel"));
    const isLive = asBoolean(formData.get("isLive"));
    const address = asOptionalString(formData.get("address"));
    const phone = asOptionalString(formData.get("phone"));
    const websiteUrl = asOptionalHttpUrl(formData.get("websiteUrl"), "Website URL");
    const priceLevel = asOptionalBoundedInt(formData.get("priceLevel"), "Price level", 1, 4);
    const dressCode = asOptionalString(formData.get("dressCode"));
    const ageRequirement = asOptionalBoundedInt(
      formData.get("ageRequirement"),
      "Age requirement",
      0,
      25
    );
    const openingHoursJson = asOptionalJsonString(formData.get("openingHoursJson"), "Opening hours JSON");
    const latitude = asOptionalFloat(formData.get("latitude"), "Latitude");
    const longitude = asOptionalFloat(formData.get("longitude"), "Longitude");
    const googleMapsUrl = asOptionalHttpUrl(formData.get("googleMapsUrl"), "Google Maps URL");

    try {
      await db
        .update(venues)
        .set({
          name,
          description,
          tagline,
          city,
          genres,
          crowdLevel,
          isLive,
          address,
          phone,
          websiteUrl,
          priceLevel,
          dressCode,
          ageRequirement,
          openingHoursJson,
          latitude,
          longitude,
          googleMapsUrl,
        })
        .where(eq(venues.id, venueId));
    } catch (error) {
      console.error("[owner] Failed to update venue profile", {
        venueId,
        error,
      });
      throw new Error("Failed to save venue profile. Please try again.");
    }

    revalidateOwnerAndVenue(venueId);
  } catch (error) {
    redirect(mutationErrorPath("/owner/venue", error));
  }

  redirect(mutationSuccessPath("/owner/venue", "Venue saved."));
}

export async function importOwnerVenueFromGoogleAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    const selectedPlaceId = asNonEmptyString(formData.get("googlePlaceId"), "Google place ID");
    const confirmReview = asBoolean(formData.get("confirmReview"));
    const confirmOverwrite = asBoolean(formData.get("confirmOverwrite"));

    if (!confirmReview) {
      throw new Error("Review confirmation is required before saving imported data.");
    }

    const { venue } = await requireAuthorizedOwnerForVenue(venueId);

    const latestGoogleDetails = await getGooglePlaceVenueDetails(selectedPlaceId);

    const name = asNonEmptyString(formData.get("name"), "Venue name");
    const address = asOptionalString(formData.get("address"));
    const city = asOptionalString(formData.get("city"));
    const phone = asOptionalString(formData.get("phone"));
    const websiteUrl = asOptionalHttpUrl(formData.get("websiteUrl"), "Website URL");
    const openingHoursJson = asOptionalJsonString(formData.get("openingHoursJson"), "Opening hours JSON");
    const latitude = asOptionalFloat(formData.get("latitude"), "Latitude");
    const longitude = asOptionalFloat(formData.get("longitude"), "Longitude");
    const googleMapsUrl = asOptionalHttpUrl(formData.get("googleMapsUrl"), "Google Maps URL");
    const googlePhotoReferencesJson = asOptionalJsonString(
      formData.get("googlePhotoReferencesJson"),
      "Google photo references"
    );
    const googleCoverPhotoReference = asOptionalString(formData.get("googleCoverPhotoReference"));
    const googleCoverImageUrl = asOptionalHttpUrl(
      formData.get("googleCoverImageUrl"),
      "Google cover image URL"
    );
    const googleGalleryImageUrlsJson = asOptionalJsonString(
      formData.get("googleGalleryImageUrlsJson"),
      "Google gallery image URLs"
    );
    const googleLogoImageUrl = asOptionalHttpUrl(
      formData.get("googleLogoImageUrl"),
      "Google logo image URL"
    );

    const overwriteCandidates: Array<{
      existing: unknown;
      incoming: unknown;
    }> = [
      { existing: venue.name, incoming: name },
      { existing: venue.address, incoming: address },
      { existing: venue.city, incoming: city },
      { existing: venue.phone, incoming: phone },
      { existing: venue.websiteUrl, incoming: websiteUrl },
      { existing: venue.openingHoursJson, incoming: openingHoursJson },
      { existing: venue.latitude, incoming: latitude },
      { existing: venue.longitude, incoming: longitude },
      { existing: venue.googleMapsUrl, incoming: googleMapsUrl },
    ];

    const hasConflict = overwriteCandidates.some((candidate) => {
      if (!hasNonEmptyValue(candidate.existing)) {
        return false;
      }

      if (!hasNonEmptyValue(candidate.incoming)) {
        return false;
      }

      return candidate.existing !== candidate.incoming;
    });

    if (hasConflict && !confirmOverwrite) {
      throw new Error(
        "This import would overwrite existing venue fields. Confirm overwrite to continue."
      );
    }

    await db
      .update(venues)
      .set({
        name,
        address,
        city,
        phone,
        websiteUrl,
        openingHoursJson,
        latitude,
        longitude,
        googleMapsUrl,
        heroImageUrl: googleCoverImageUrl ?? venue.heroImageUrl,
        thumbnailImageUrl: googleCoverImageUrl ?? venue.thumbnailImageUrl,
        galleryImageUrlsJson: googleGalleryImageUrlsJson ?? venue.galleryImageUrlsJson,
        googlePhotoReferencesJson: googlePhotoReferencesJson ?? venue.googlePhotoReferencesJson,
        googleCoverPhotoReference: googleCoverPhotoReference ?? venue.googleCoverPhotoReference,
        googleLogoImageUrl: googleLogoImageUrl ?? venue.googleLogoImageUrl,
        googlePlaceId: latestGoogleDetails.placeId,
        googleImportedAt: new Date(),
        googleDataConfirmedByOwnerAt: new Date(),
        officialWebsiteUrl: websiteUrl,
      })
      .where(eq(venues.id, venueId));

    await refreshVenueImagesForVenue({ venueId, force: false });

    revalidateOwnerAndVenue(venueId);
  } catch (error) {
    redirect(mutationErrorPath("/owner/venue", error));
  }

  redirect("/owner/venue?success=business-information-imported");
}

export async function refreshOwnerVenueImagesAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    const force = asBoolean(formData.get("forceRefresh"));

    await assertCurrentOwnerVenueId(venueId);

    const result = await refreshVenueImagesForVenue({
      venueId,
      force,
    });

    if (result.status === "failed") {
      throw new Error(result.reason);
    }

    revalidateOwnerAndVenue(venueId);
    redirect(mutationSuccessPath("/owner/venue", `Image refresh ${result.status}.`));
  } catch (error) {
    redirect(mutationErrorPath("/owner/venue", error));
  }
}

export async function addOwnerVenueImageAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

    const imageUrl = normalizeHttpUrl(formData.get("imageUrl"));
    const caption = asOptionalString(formData.get("caption"));

    const [maxResult] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${venueImages.sortOrder}), -1)` })
      .from(venueImages)
      .where(eq(venueImages.venueId, venueId));

    const nextSortOrder = (maxResult?.maxOrder ?? -1) + 1;

    await db.insert(venueImages).values({
      venueId,
      imageUrl,
      caption,
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

    const venueId = await assertCurrentOwnerVenueId(input.venueId);
    const blobUrl = asValidBlobVenueAssetUrl(input.blobUrl, `/venue-images/${venueId}/`);
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
      caption: null,
      sortOrder: nextSortOrder,
    });

    revalidateOwnerAndVenue(venueId);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload persistence failed.";
    return { success: false, error: message };
  }
}

type AddOwnerVenueLogoFromBlobActionInput = {
  venueId: number;
  blobUrl: string;
};

export async function addOwnerVenueLogoFromBlobAction(
  input: AddOwnerVenueLogoFromBlobActionInput
): Promise<AddOwnerVenueImageFromBlobActionResult> {
  try {
    if (!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim()) {
      throw new Error("Blob upload token is not configured.");
    }

    if (!Number.isInteger(input.venueId)) {
      throw new Error("Venue ID must be a valid number.");
    }

    const venueId = await assertCurrentOwnerVenueId(input.venueId);
    const blobUrl = asValidBlobVenueAssetUrl(input.blobUrl, `/venue-logos/${venueId}/`);
    const blob = await head(blobUrl, { token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN });
    const expectedPathPrefix = `venue-logos/${venueId}/`;

    if (!blob.pathname.startsWith(expectedPathPrefix)) {
      throw new Error("Uploaded logo path is invalid for this venue.");
    }

    if (!ALLOWED_OWNER_IMAGE_CONTENT_TYPES.has(blob.contentType)) {
      throw new Error("Uploaded logo type is not supported.");
    }

    if (blob.size > MAX_OWNER_LOGO_SIZE_BYTES) {
      throw new Error("Uploaded logo must be 5 MB or smaller.");
    }

    await db
      .update(venues)
      .set({ logoUrl: blob.url })
      .where(eq(venues.id, venueId));

    revalidateOwnerAndVenue(venueId);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logo upload persistence failed.";
    return { success: false, error: message };
  }
}

export async function deleteOwnerVenueImageAction(formData: FormData) {
  try {
    const imageId = asInt(formData.get("imageId"), "Image ID");
    const image = await ensureImageOwnedByCurrentOwner(imageId);

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
    const image = await ensureImageOwnedByCurrentOwner(imageId);

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
    const image = await ensureImageOwnedByCurrentOwner(imageId);

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

export async function updateOwnerVenueImageCaptionAction(formData: FormData) {
  try {
    const imageId = asInt(formData.get("imageId"), "Image ID");
    const image = await ensureImageOwnedByCurrentOwner(imageId);
    const caption = asOptionalString(formData.get("caption"));

    await db.update(venueImages).set({ caption }).where(eq(venueImages.id, imageId));

    revalidateOwnerAndVenue(image.venueId);
    redirect(mutationSuccessPath("/owner/images", "Image caption updated."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/images", error));
  }
}

export async function createOwnerEventAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

    const title = asNonEmptyString(formData.get("title"), "Title");
    const description = asOptionalString(formData.get("description"));
    const startsAt = asDateTimeLocal(formData.get("startsAt"), "Start date/time");
    const endsAt = asOptionalDateTimeLocal(formData.get("endsAt"), "End date/time");
    const coverImageUrl = asOptionalHttpUrl(formData.get("coverImageUrl"), "Cover image URL");
    const ticketUrl = asOptionalHttpUrl(formData.get("ticketUrl"), "Ticket URL");
    const guestListUrl = asOptionalHttpUrl(formData.get("guestListUrl"), "Guest list URL");
    const reservationUrl = asOptionalHttpUrl(formData.get("reservationUrl"), "Reservation URL");
    const coverCents = asCurrencyCents(formData.get("priceDollars"), "Price");
    const ageRequirement = asOptionalBoundedInt(formData.get("ageRequirement"), "Age requirement", 0, 25);
    const genre = asOptionalString(formData.get("genre"));
    const dressCode = asOptionalString(formData.get("dressCode"));
    const eventType = normalizeEventType(formData.get("eventType"));
    const recurrenceRule = asOptionalString(formData.get("recurrenceRule"));
    const specialDetails = asOptionalString(formData.get("specialDetails"));
    const wantsPublished = asBoolean(formData.get("isPublished"));
    const approvalStatus = moderationRequiredForEvents() ? "pending" : "approved";
    const isPublished = moderationRequiredForEvents() ? false : wantsPublished;
    const publicationStatus = isPublished ? "published" : moderationRequiredForEvents() ? "pending_review" : "draft";

    if (endsAt && endsAt <= startsAt) {
      throw new Error("End time must be later than start time.");
    }

    await db.insert(events).values({
      venueId,
      title,
      description,
      eventDate: startsAt,
      startTime: toTimeText(startsAt),
      endTime: endsAt ? toTimeText(endsAt) : null,
      startsAt,
      endsAt,
      coverImageUrl,
      ticketUrl,
      guestListUrl,
      reservationUrl,
      eventType,
      recurrenceRule,
      specialDetails,
      coverCents,
      ageRequirement,
      genre,
      dressCode,
      approvalStatus,
      isFeatured: false,
      is21Plus: (ageRequirement ?? 0) >= 21,
      isPublished,
      publicationStatus,
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
    const event = await ensureEventOwnedByCurrentOwner(eventId);

    const title = asNonEmptyString(formData.get("title"), "Title");
    const description = asOptionalString(formData.get("description"));
    const startsAt = asDateTimeLocal(formData.get("startsAt"), "Start date/time");
    const endsAt = asOptionalDateTimeLocal(formData.get("endsAt"), "End date/time");
    const coverImageUrl = asOptionalHttpUrl(formData.get("coverImageUrl"), "Cover image URL");
    const ticketUrl = asOptionalHttpUrl(formData.get("ticketUrl"), "Ticket URL");
    const guestListUrl = asOptionalHttpUrl(formData.get("guestListUrl"), "Guest list URL");
    const reservationUrl = asOptionalHttpUrl(formData.get("reservationUrl"), "Reservation URL");
    const coverCents = asCurrencyCents(formData.get("priceDollars"), "Price");
    const ageRequirement = asOptionalBoundedInt(formData.get("ageRequirement"), "Age requirement", 0, 25);
    const genre = asOptionalString(formData.get("genre"));
    const dressCode = asOptionalString(formData.get("dressCode"));
    const eventType = normalizeEventType(formData.get("eventType"));
    const recurrenceRule = asOptionalString(formData.get("recurrenceRule"));
    const specialDetails = asOptionalString(formData.get("specialDetails"));
    const wantsPublished = asBoolean(formData.get("isPublished"));
    const approvalStatus = moderationRequiredForEvents() ? "pending" : "approved";
    const isPublished = moderationRequiredForEvents() ? false : wantsPublished;
    const publicationStatus = isPublished ? "published" : moderationRequiredForEvents() ? "pending_review" : "draft";

    if (endsAt && endsAt <= startsAt) {
      throw new Error("End time must be later than start time.");
    }

    await db
      .update(events)
      .set({
        title,
        description,
        eventDate: startsAt,
        startTime: toTimeText(startsAt),
        endTime: endsAt ? toTimeText(endsAt) : null,
        startsAt,
        endsAt,
        coverImageUrl,
        ticketUrl,
        guestListUrl,
        reservationUrl,
        eventType,
        recurrenceRule,
        specialDetails,
        coverCents,
        ageRequirement,
        genre,
        dressCode,
        approvalStatus,
        isFeatured: false,
        is21Plus: (ageRequirement ?? 0) >= 21,
        isPublished,
        publicationStatus,
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

    const event = await ensureEventOwnedByCurrentOwner(eventId);

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

function normalizeCameraStreamType(value: FormDataEntryValue | null) {
  const streamType = asNonEmptyString(value, "Stream type").toLowerCase();
  const allowed = new Set(["hls", "rtsp", "webrtc", "other"]);

  if (!allowed.has(streamType)) {
    throw new Error("Stream type must be one of: hls, rtsp, webrtc, other.");
  }

  return streamType;
}

export async function addOwnerCameraAction(formData: FormData) {
  try {
    const venueId = asInt(formData.get("venueId"), "Venue ID");
    await assertCurrentOwnerVenueId(venueId);

    const name = asNonEmptyString(formData.get("name"), "Camera name");
    const streamUrl = asNonEmptyString(formData.get("streamUrl"), "Stream URL");
    const streamType = normalizeCameraStreamType(formData.get("streamType"));
    const isEnabled = asBoolean(formData.get("isEnabled"));

    await db.insert(venueCameras).values({
      venueId,
      name,
      streamUrl,
      streamType,
      status: isEnabled ? "enabled" : "disabled",
      isPrimary: false,
    });

    revalidateOwnerAndVenue(venueId);
    redirect(mutationSuccessPath("/owner/cameras", "Camera added."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/cameras", error));
  }
}

export async function renameOwnerCameraAction(formData: FormData) {
  try {
    const cameraId = asInt(formData.get("cameraId"), "Camera ID");
    const camera = await ensureCameraOwnedByCurrentOwner(cameraId);
    const name = asNonEmptyString(formData.get("name"), "Camera name");

    await db.update(venueCameras).set({ name }).where(eq(venueCameras.id, cameraId));

    revalidateOwnerAndVenue(camera.venueId);
    redirect(mutationSuccessPath("/owner/cameras", "Camera renamed."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/cameras", error));
  }
}

export async function setPrimaryOwnerCameraAction(formData: FormData) {
  try {
    const cameraId = asInt(formData.get("cameraId"), "Camera ID");
    const camera = await ensureCameraOwnedByCurrentOwner(cameraId);

    await db.update(venueCameras).set({ isPrimary: false }).where(eq(venueCameras.venueId, camera.venueId));
    await db.update(venueCameras).set({ isPrimary: true }).where(eq(venueCameras.id, cameraId));

    revalidateOwnerAndVenue(camera.venueId);
    redirect(mutationSuccessPath("/owner/cameras", "Primary camera updated."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/cameras", error));
  }
}

export async function toggleOwnerCameraStatusAction(formData: FormData) {
  try {
    const cameraId = asInt(formData.get("cameraId"), "Camera ID");
    const camera = await ensureCameraOwnedByCurrentOwner(cameraId);
    const nextStatus = asNonEmptyString(formData.get("status"), "Status").toLowerCase();

    if (nextStatus !== "enabled" && nextStatus !== "disabled") {
      throw new Error("Status must be enabled or disabled.");
    }

    await db.update(venueCameras).set({ status: nextStatus }).where(eq(venueCameras.id, cameraId));

    revalidateOwnerAndVenue(camera.venueId);
    redirect(
      mutationSuccessPath(
        "/owner/cameras",
        nextStatus === "enabled" ? "Camera enabled." : "Camera disabled."
      )
    );
  } catch (error) {
    redirect(mutationErrorPath("/owner/cameras", error));
  }
}

export async function deleteOwnerCameraAction(formData: FormData) {
  try {
    const cameraId = asInt(formData.get("cameraId"), "Camera ID");
    const camera = await ensureCameraOwnedByCurrentOwner(cameraId);

    await db.delete(venueCameras).where(eq(venueCameras.id, cameraId));

    revalidateOwnerAndVenue(camera.venueId);
    redirect(mutationSuccessPath("/owner/cameras", "Camera deleted."));
  } catch (error) {
    redirect(mutationErrorPath("/owner/cameras", error));
  }
}
