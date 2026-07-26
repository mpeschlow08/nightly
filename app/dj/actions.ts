"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { djProfiles, users } from "@/db/schema";

import {
  DJ_USERNAME_REGEX,
  normalizeGenres,
  requireDjForOnboarding,
  toUsernameSlug,
  usernameTakenByAnotherUser,
} from "./lib/data";

function failOnboarding(message: string, editMode = false): never {
  const query = new URLSearchParams({ error: message });

  if (editMode) {
    query.set("edit", "1");
  }

  redirect(`/dj/onboarding?${query.toString()}`);
}

function asOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function asRequiredString(value: FormDataEntryValue | null, label: string, editMode: boolean) {
  const text = asOptionalString(value);

  if (!text) {
    failOnboarding(`${label} is required.`, editMode);
  }

  return text;
}

function asOptionalInteger(value: FormDataEntryValue | null, label: string, editMode: boolean) {
  const text = asOptionalString(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    failOnboarding(`${label} must be a non-negative number.`, editMode);
  }

  return parsed;
}

function asOptionalNonNegativeCents(value: FormDataEntryValue | null, editMode: boolean) {
  const text = asOptionalString(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);

  if (!Number.isFinite(parsed) || parsed < 0) {
    failOnboarding("Starting rate must be zero or greater.", editMode);
  }

  return Math.round(parsed * 100);
}

function asOptionalHttpUrl(value: FormDataEntryValue | null, label: string, editMode: boolean) {
  const text = asOptionalString(value);

  if (!text) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(text);
  } catch {
    failOnboarding(`${label} must be a valid URL.`, editMode);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    failOnboarding(`${label} must start with http:// or https://.`, editMode);
  }

  return parsed.toString();
}

function asOptionalEmail(value: FormDataEntryValue | null, editMode: boolean) {
  const text = asOptionalString(value);

  if (!text) {
    return null;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(text)) {
    failOnboarding("Booking email must be a valid email address.", editMode);
  }

  return text.toLowerCase();
}

export async function saveDjOnboarding(formData: FormData) {
  const user = await requireDjForOnboarding();
  const isEditMode = formData.get("editMode") === "1";

  const stageName = asRequiredString(formData.get("stageName"), "Stage name", isEditMode);
  const usernameRaw = asRequiredString(formData.get("username"), "Username", isEditMode);
  const username = toUsernameSlug(usernameRaw);
  const city = asRequiredString(formData.get("city"), "City", isEditMode);
  const genres = normalizeGenres(formData.getAll("genres").map((value) => String(value)));

  const bio = asOptionalString(formData.get("bio"));
  const profileImageUrl = asOptionalHttpUrl(formData.get("profileImageUrl"), "Profile image URL", isEditMode);
  const yearsPerforming = asOptionalInteger(formData.get("yearsPerforming"), "Years performing", isEditMode);
  const isResidentDj = formData.get("isResidentDj") === "on";
  const residentVenueName = isResidentDj
    ? asRequiredString(formData.get("residentVenueName"), "Resident venue name", isEditMode)
    : null;
  const instagramUrl = asOptionalHttpUrl(formData.get("instagramUrl"), "Instagram URL", isEditMode);
  const tiktokUrl = asOptionalHttpUrl(formData.get("tiktokUrl"), "TikTok URL", isEditMode);
  const soundcloudUrl = asOptionalHttpUrl(formData.get("soundcloudUrl"), "SoundCloud URL", isEditMode);
  const websiteUrl = asOptionalHttpUrl(formData.get("websiteUrl"), "Website URL", isEditMode);
  const bookingEmail = asOptionalEmail(formData.get("bookingEmail"), isEditMode);
  const rateCents = asOptionalNonNegativeCents(formData.get("rateDollars"), isEditMode);
  const isAvailableForBooking = formData.get("isAvailableForBooking") === "on";

  if (!DJ_USERNAME_REGEX.test(username)) {
    failOnboarding("Username can include lowercase letters, numbers, hyphens, and underscores only.", isEditMode);
  }

  if (genres.length === 0) {
    failOnboarding("Select at least one genre.", isEditMode);
  }

  const isUsernameTaken = await usernameTakenByAnotherUser(username, user.id);

  if (isUsernameTaken) {
    failOnboarding("This username is already taken.", isEditMode);
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(djProfiles)
      .values({
        userId: user.id,
        stageName,
        username,
        city,
        genres,
        bio,
        profileImageUrl,
        yearsPerforming,
        isResidentDj,
        residentVenueName,
        instagramUrl,
        tiktokUrl,
        soundcloudUrl,
        websiteUrl,
        bookingEmail,
        rateCents,
        isAvailableForBooking,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: djProfiles.userId,
        set: {
          stageName,
          username,
          city,
          genres,
          bio,
          profileImageUrl,
          yearsPerforming,
          isResidentDj,
          residentVenueName,
          instagramUrl,
          tiktokUrl,
          soundcloudUrl,
          websiteUrl,
          bookingEmail,
          rateCents,
          isAvailableForBooking,
          updatedAt: now,
        },
      });

    await tx
      .update(users)
      .set({
        isOnboarded: true,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
  });

  redirect("/dj/dashboard");
}
