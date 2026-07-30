"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { venueProfileChangeRequests, venuePublishHistory, venues } from "@/db/schema";

import { getCurrentOwnerVenue } from "./lib/ownership";

function asOptional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function parseGenres(value: FormDataEntryValue | null) {
  const text = asOptional(value);

  if (!text) {
    return [] as string[];
  }

  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function ownerRedirect(path: string, kind: "success" | "error", message: string) {
  const query = new URLSearchParams({ [kind]: message });
  return `${path}?${query.toString()}`;
}

function revalidateOwnerAndConsumer(venueId: number) {
  revalidatePath("/owner");
  revalidatePath("/owner/profile-completion");
  revalidatePath("/owner/publishing");
  revalidatePath("/owner/venue");
  revalidatePath(`/venues/${venueId}`);
  revalidateTag("consumer:venues", "max");
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
}

export async function submitOwnerProfileForReviewAction(formData: FormData) {
  try {
    const ownership = await getCurrentOwnerVenue();

    const description = asOptional(formData.get("description"));
    const genres = parseGenres(formData.get("genres"));
    const amenities = asOptional(formData.get("amenities"));
    const dressCode = asOptional(formData.get("dressCode"));
    const parkingInformation = asOptional(formData.get("parkingInformation"));
    const vipAvailable = asBoolean(formData.get("vipAvailable"));
    const bottleServiceAvailable = asBoolean(formData.get("bottleServiceAvailable"));
    const socialInstagram = asOptional(formData.get("socialInstagram"));
    const socialTiktok = asOptional(formData.get("socialTiktok"));
    const socialX = asOptional(formData.get("socialX"));
    const contactEmail = asOptional(formData.get("contactEmail"));
    const contactPhone = asOptional(formData.get("contactPhone"));
    const websiteUrl = asOptional(formData.get("websiteUrl"));

    const proposed = {
      description,
      genres,
      amenitiesJson: amenities ? JSON.stringify(amenities.split(",").map((item) => item.trim()).filter(Boolean)) : null,
      dressCode,
      parkingInformation,
      vipAvailable,
      bottleServiceAvailable,
      socialLinksJson: JSON.stringify({
        instagram: socialInstagram,
        tiktok: socialTiktok,
        x: socialX,
      }),
      contactEmail,
      contactPhone,
      websiteUrl,
    };

    const previous = {
      description: ownership.venue.description,
      genres: ownership.venue.genres ?? [],
      amenitiesJson: ownership.venue.amenitiesJson,
      dressCode: ownership.venue.dressCode,
      parkingInformation: ownership.venue.parkingInformation,
      vipAvailable: ownership.venue.vipAvailable,
      bottleServiceAvailable: ownership.venue.bottleServiceAvailable,
      socialLinksJson: ownership.venue.socialLinksJson,
      contactEmail: ownership.venue.contactEmail,
      contactPhone: ownership.venue.phone,
      websiteUrl: ownership.venue.websiteUrl,
    };

    const existingPending = await db.query.venueProfileChangeRequests.findFirst({
      where: and(
        eq(venueProfileChangeRequests.venueId, ownership.venueId),
        eq(venueProfileChangeRequests.status, "pending")
      ),
      columns: { id: true },
    });

    if (existingPending) {
      throw new Error("A profile change request is already pending review.");
    }

    const [request] = await db
      .insert(venueProfileChangeRequests)
      .values({
        venueId: ownership.venueId,
        submittedByClerkUserId: ownership.clerkUserId,
        previousValuesJson: JSON.stringify(previous),
        proposedValuesJson: JSON.stringify(proposed),
        status: "pending",
      })
      .returning({ id: venueProfileChangeRequests.id });

    await writeAuditLog({
      actorClerkUserId: ownership.clerkUserId,
      actorRole: ownership.role,
      entityType: "venue_profile_change_request",
      entityId: request.id,
      action: "profile_change_submitted",
      previousValues: previous,
      nextValues: proposed,
      metadata: { venueId: ownership.venueId },
    });

    revalidateOwnerAndConsumer(ownership.venueId);
    redirect(ownerRedirect("/owner/profile-completion", "success", "Profile submission sent for admin review."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit profile changes.";
    redirect(ownerRedirect("/owner/profile-completion", "error", message));
  }
}

export async function publishOwnerVenueAction(formData: FormData) {
  try {
    const ownership = await getCurrentOwnerVenue();
    const publishNotes = asOptional(formData.get("publishNotes"));

    const pendingChanges = await db.query.venueProfileChangeRequests.findFirst({
      where: and(
        eq(venueProfileChangeRequests.venueId, ownership.venueId),
        eq(venueProfileChangeRequests.status, "pending")
      ),
      columns: { id: true },
    });

    if (pendingChanges) {
      throw new Error("Profile changes are still pending review. Resolve moderation before publishing.");
    }

    if (ownership.venue.verificationStatus !== "verified") {
      throw new Error("Venue verification is incomplete. Wait for claim approval before publishing.");
    }

    const previousStatus = ownership.venue.publicationStatus;

    await db
      .update(venues)
      .set({
        publicationStatus: "published",
        updatedAt: new Date(),
      })
      .where(eq(venues.id, ownership.venueId));

    await db.insert(venuePublishHistory).values({
      venueId: ownership.venueId,
      actorClerkUserId: ownership.clerkUserId,
      action: "published",
      previousStatus,
      nextStatus: "published",
      notes: publishNotes,
    });

    await writeAuditLog({
      actorClerkUserId: ownership.clerkUserId,
      actorRole: ownership.role,
      entityType: "venue",
      entityId: ownership.venueId,
      action: "venue_published",
      previousValues: { publicationStatus: previousStatus },
      nextValues: { publicationStatus: "published" },
      metadata: { publishNotes },
    });

    revalidateOwnerAndConsumer(ownership.venueId);
    redirect(ownerRedirect("/owner/publishing", "success", "Venue published across consumer experiences."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish venue.";
    redirect(ownerRedirect("/owner/publishing", "error", message));
  }
}

export async function unpublishOwnerVenueAction() {
  try {
    const ownership = await getCurrentOwnerVenue();
    const previousStatus = ownership.venue.publicationStatus;

    await db
      .update(venues)
      .set({
        publicationStatus: "draft",
        updatedAt: new Date(),
      })
      .where(eq(venues.id, ownership.venueId));

    await db.insert(venuePublishHistory).values({
      venueId: ownership.venueId,
      actorClerkUserId: ownership.clerkUserId,
      action: "unpublished",
      previousStatus,
      nextStatus: "draft",
      notes: "Unpublished by owner",
    });

    await writeAuditLog({
      actorClerkUserId: ownership.clerkUserId,
      actorRole: ownership.role,
      entityType: "venue",
      entityId: ownership.venueId,
      action: "venue_unpublished",
      previousValues: { publicationStatus: previousStatus },
      nextValues: { publicationStatus: "draft" },
    });

    revalidateOwnerAndConsumer(ownership.venueId);
    redirect(ownerRedirect("/owner/publishing", "success", "Venue moved back to draft."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unpublish venue.";
    redirect(ownerRedirect("/owner/publishing", "error", message));
  }
}
