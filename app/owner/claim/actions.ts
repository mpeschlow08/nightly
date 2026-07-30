"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClaimRequest } from "@/app/owner/lib/claim-workflow";

function asRequired(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function asOptional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function asOptionalInt(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalWebsite(value: FormDataEntryValue | null) {
  const text = asOptional(value);

  if (!text) {
    return null;
  }

  const parsed = new URL(text);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website must use http or https.");
  }

  return parsed.toString();
}

function mutationRedirect(path: string, message: string, key: "success" | "error") {
  const query = new URLSearchParams({ [key]: message });
  return `${path}?${query.toString()}`;
}

export async function requestVenueClaimAction(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  try {
    const venueId = asOptionalInt(formData.get("venueId"));
    const googlePlaceId = asOptional(formData.get("googlePlaceId"));

    const venueName = asRequired(formData.get("venueName"), "Venue name");
    const venueAddress = asRequired(formData.get("venueAddress"), "Venue address");
    const venueCategory = asOptional(formData.get("venueCategory"));

    const businessEmail = asRequired(formData.get("businessEmail"), "Business email");
    const businessPhone = asRequired(formData.get("businessPhone"), "Business phone");
    const websiteUrl = asOptionalWebsite(formData.get("websiteUrl"));
    const claimantRole = asRequired(formData.get("claimantRole"), "Role");
    const notes = asOptional(formData.get("notes"));

    await createClaimRequest({
      claimantClerkUserId: userId,
      claimantRole,
      venueId,
      googlePlaceId,
      venueName,
      venueAddress,
      venueCategory,
      businessEmail,
      businessPhone,
      websiteUrl,
      notes,
    });

    revalidatePath("/owner/claim");
    redirect(mutationRedirect("/owner/claim", "Claim request submitted for review.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim request failed.";
    redirect(mutationRedirect("/owner/claim", message, "error"));
  }
}
