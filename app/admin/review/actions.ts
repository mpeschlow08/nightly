"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { requireAdminUser } from "@/app/admin/lib/auth";
import { writeAuditLog } from "@/app/lib/audit-log";
import { getGooglePlaceVenueDetails } from "@/app/owner/lib/google-places";
import { db } from "@/db";
import {
  eventModerationFlags,
  eventRevisionRequests,
  events,
  venueClaimRequests,
  venueMembers,
  venueProfileChangeRequests,
  venuePublishHistory,
  venues,
} from "@/db/schema";

function asInt(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseInt(text, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is invalid.`);
  }

  return parsed;
}

function asOptional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function revalidateConsumerAndAdmin(venueId?: number | null) {
  revalidatePath("/admin/review");
  revalidatePath("/owner/claim");

  if (venueId) {
    revalidatePath(`/venues/${venueId}`);
  }

  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
  revalidateTag("consumer:venues", "max");
  revalidateTag("consumer:events", "max");
}

function adminReviewRedirect(message: string, kind: "success" | "error") {
  const query = new URLSearchParams({ [kind]: message });
  return `/admin/review?${query.toString()}`;
}

async function resolveOrCreateVenueForClaim(request: {
  venueId: number | null;
  googlePlaceId: string | null;
  venueName: string;
  venueAddress: string;
}) {
  if (request.venueId) {
    return request.venueId;
  }

  if (request.googlePlaceId) {
    const existing = await db.query.venues.findFirst({
      where: eq(venues.googlePlaceId, request.googlePlaceId),
      columns: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const details = await getGooglePlaceVenueDetails(request.googlePlaceId);

    const [created] = await db
      .insert(venues)
      .values({
        name: details.displayName,
        slug: slugify(details.displayName),
        address: details.formattedAddress,
        city: details.city,
        phone: details.nationalPhoneNumber,
        websiteUrl: details.websiteUri,
        googlePlaceId: details.placeId,
        heroImageUrl: details.coverImageUrl,
        thumbnailImageUrl: details.coverImageUrl,
        googleLogoImageUrl: details.logoImageUrl,
        googlePhotoReferencesJson: JSON.stringify(details.photoReferences),
        googleCoverPhotoReference: details.coverPhotoReference,
        galleryImageUrlsJson: JSON.stringify(details.galleryImageUrls),
        openingHoursJson: details.regularOpeningHours ? JSON.stringify(details.regularOpeningHours) : null,
        latitude: details.latitude,
        longitude: details.longitude,
        googleMapsUrl: details.googleMapsUri,
        publicationStatus: "draft",
        verificationStatus: "unverified",
        googleImportedAt: new Date(),
      })
      .returning({ id: venues.id });

    return created.id;
  }

  const [created] = await db
    .insert(venues)
    .values({
      name: request.venueName,
      slug: slugify(request.venueName),
      address: request.venueAddress,
      publicationStatus: "draft",
      verificationStatus: "unverified",
    })
    .returning({ id: venues.id });

  return created.id;
}

export async function approveClaimRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const claimRequestId = asInt(formData.get("claimRequestId"), "Claim request ID");
    const adminNotes = asOptional(formData.get("adminNotes"));

    const claim = await db.query.venueClaimRequests.findFirst({
      where: eq(venueClaimRequests.id, claimRequestId),
    });

    if (!claim) {
      throw new Error("Claim request not found.");
    }

    if (claim.status !== "pending") {
      throw new Error("Only pending claim requests can be approved.");
    }

    const venueId = await resolveOrCreateVenueForClaim({
      venueId: claim.venueId,
      googlePlaceId: claim.googlePlaceId,
      venueName: claim.venueName,
      venueAddress: claim.venueAddress,
    });

    await db
      .update(venueClaimRequests)
      .set({
        status: "approved",
        venueId,
        reviewedByClerkUserId: admin.clerkUserId,
        reviewedAt: new Date(),
        adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(venueClaimRequests.id, claimRequestId));

    const existingMembership = await db.query.venueMembers.findFirst({
      where: and(
        eq(venueMembers.venueId, venueId),
        eq(venueMembers.clerkUserId, claim.claimantClerkUserId)
      ),
      columns: { id: true },
    });

    if (!existingMembership) {
      await db.insert(venueMembers).values({
        venueId,
        clerkUserId: claim.claimantClerkUserId,
        role: "owner",
      });
    }

    await db
      .update(venueClaimRequests)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(venueClaimRequests.id, claimRequestId));

    await db
      .update(venues)
      .set({
        verificationStatus: "verified",
        publicationStatus: "draft",
      })
      .where(eq(venues.id, venueId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "venue_claim_request",
      entityId: claimRequestId,
      action: "claim_approved_and_linked",
      previousValues: { status: claim.status, venueId: claim.venueId },
      nextValues: { status: "claimed", venueId, claimant: claim.claimantClerkUserId },
      metadata: { adminNotes },
    });

    revalidateConsumerAndAdmin(venueId);
    redirect(adminReviewRedirect("Claim approved and linked to owner account.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve claim.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function rejectClaimRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const claimRequestId = asInt(formData.get("claimRequestId"), "Claim request ID");
    const adminNotes = asOptional(formData.get("adminNotes"));

    const claim = await db.query.venueClaimRequests.findFirst({
      where: eq(venueClaimRequests.id, claimRequestId),
    });

    if (!claim) {
      throw new Error("Claim request not found.");
    }

    if (claim.status !== "pending") {
      throw new Error("Only pending claim requests can be rejected.");
    }

    await db
      .update(venueClaimRequests)
      .set({
        status: "rejected",
        reviewedByClerkUserId: admin.clerkUserId,
        reviewedAt: new Date(),
        adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(venueClaimRequests.id, claimRequestId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "venue_claim_request",
      entityId: claimRequestId,
      action: "claim_rejected",
      previousValues: { status: claim.status },
      nextValues: { status: "rejected" },
      metadata: { adminNotes },
    });

    revalidateConsumerAndAdmin(claim.venueId);
    redirect(adminReviewRedirect("Claim request rejected.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject claim.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

function parseJsonObject(value: string) {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parsed;
}

export async function approveProfileChangeRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const profileRequestId = asInt(formData.get("profileRequestId"), "Profile request ID");
    const reviewNotes = asOptional(formData.get("reviewNotes"));

    const profileRequest = await db.query.venueProfileChangeRequests.findFirst({
      where: eq(venueProfileChangeRequests.id, profileRequestId),
    });

    if (!profileRequest) {
      throw new Error("Profile change request not found.");
    }

    if (profileRequest.status !== "pending") {
      throw new Error("Only pending profile change requests can be approved.");
    }

    const proposed = parseJsonObject(profileRequest.proposedValuesJson);

    await db
      .update(venues)
      .set({
        description: typeof proposed.description === "string" ? proposed.description : null,
        genres: Array.isArray(proposed.genres)
          ? proposed.genres.filter((item): item is string => typeof item === "string")
          : null,
        amenitiesJson: typeof proposed.amenitiesJson === "string" ? proposed.amenitiesJson : null,
        dressCode: typeof proposed.dressCode === "string" ? proposed.dressCode : null,
        parkingInformation:
          typeof proposed.parkingInformation === "string" ? proposed.parkingInformation : null,
        vipAvailable: typeof proposed.vipAvailable === "boolean" ? proposed.vipAvailable : null,
        bottleServiceAvailable:
          typeof proposed.bottleServiceAvailable === "boolean" ? proposed.bottleServiceAvailable : null,
        socialLinksJson: typeof proposed.socialLinksJson === "string" ? proposed.socialLinksJson : null,
        contactEmail: typeof proposed.contactEmail === "string" ? proposed.contactEmail : null,
        phone: typeof proposed.contactPhone === "string" ? proposed.contactPhone : null,
        websiteUrl: typeof proposed.websiteUrl === "string" ? proposed.websiteUrl : null,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, profileRequest.venueId));

    await db
      .update(venueProfileChangeRequests)
      .set({
        status: "approved",
        reviewNotes,
        reviewedByClerkUserId: admin.clerkUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(venueProfileChangeRequests.id, profileRequestId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "venue_profile_change_request",
      entityId: profileRequestId,
      action: "profile_change_approved",
      previousValues: parseJsonObject(profileRequest.previousValuesJson),
      nextValues: proposed,
      metadata: { reviewNotes, venueId: profileRequest.venueId },
    });

    revalidateConsumerAndAdmin(profileRequest.venueId);
    redirect(adminReviewRedirect("Profile change request approved.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve profile request.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function rejectProfileChangeRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const profileRequestId = asInt(formData.get("profileRequestId"), "Profile request ID");
    const reviewNotes = asOptional(formData.get("reviewNotes"));

    const profileRequest = await db.query.venueProfileChangeRequests.findFirst({
      where: eq(venueProfileChangeRequests.id, profileRequestId),
    });

    if (!profileRequest) {
      throw new Error("Profile change request not found.");
    }

    if (profileRequest.status !== "pending") {
      throw new Error("Only pending profile change requests can be rejected.");
    }

    await db
      .update(venueProfileChangeRequests)
      .set({
        status: "rejected",
        reviewNotes,
        reviewedByClerkUserId: admin.clerkUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(venueProfileChangeRequests.id, profileRequestId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "venue_profile_change_request",
      entityId: profileRequestId,
      action: "profile_change_rejected",
      metadata: { reviewNotes, venueId: profileRequest.venueId },
    });

    revalidateConsumerAndAdmin(profileRequest.venueId);
    redirect(adminReviewRedirect("Profile change request rejected.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject profile request.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function approveOwnerEventAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const eventId = asInt(formData.get("eventId"), "Event ID");
    const publishNow = formData.get("publishNow") === "on";

    const [event] = await db
      .select({ id: events.id, venueId: events.venueId, approvalStatus: events.approvalStatus, isPublished: events.isPublished })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      throw new Error("Event not found.");
    }

    await db
      .update(events)
      .set({
        approvalStatus: "approved",
        isPublished: publishNow ? true : event.isPublished,
        publicationStatus: publishNow ? "published" : "draft",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "event",
      entityId: eventId,
      action: "event_approved",
      previousValues: { approvalStatus: event.approvalStatus, isPublished: event.isPublished },
      nextValues: {
        approvalStatus: "approved",
        isPublished: publishNow ? true : event.isPublished,
      },
    });

    revalidateConsumerAndAdmin(event.venueId);
    redirect(adminReviewRedirect("Event approved.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve event.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function rejectOwnerEventAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const eventId = asInt(formData.get("eventId"), "Event ID");
    const reviewNotes = asOptional(formData.get("reviewNotes"));

    const [event] = await db
      .select({ id: events.id, venueId: events.venueId, approvalStatus: events.approvalStatus })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      throw new Error("Event not found.");
    }

    await db
      .update(events)
      .set({
        approvalStatus: "rejected",
        isPublished: false,
        publicationStatus: "draft",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    if (reviewNotes) {
      await db.insert(eventRevisionRequests).values({
        eventId,
        requestedByClerkUserId: admin.clerkUserId,
        notes: reviewNotes,
        status: "open",
      });
    }

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "event",
      entityId: eventId,
      action: "event_rejected",
      metadata: { reviewNotes, revisionRequestCreated: Boolean(reviewNotes) },
    });

    revalidateConsumerAndAdmin(event.venueId);
    redirect(adminReviewRedirect("Event rejected.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject event.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function resolveEventFlagAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const flagId = asInt(formData.get("flagId"), "Flag ID");

    const [flag] = await db
      .select({ id: eventModerationFlags.id, eventId: eventModerationFlags.eventId, status: eventModerationFlags.status })
      .from(eventModerationFlags)
      .where(eq(eventModerationFlags.id, flagId))
      .limit(1);

    if (!flag) {
      throw new Error("Event flag not found.");
    }

    await db
      .update(eventModerationFlags)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(eq(eventModerationFlags.id, flagId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "event",
      entityId: flag.eventId,
      action: "event_flag_resolved",
      metadata: { flagId, previousStatus: flag.status },
    });

    revalidateConsumerAndAdmin();
    redirect(adminReviewRedirect("Event flag resolved.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve event flag.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function resolveEventRevisionRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const revisionRequestId = asInt(formData.get("revisionRequestId"), "Revision request ID");

    const [request] = await db
      .select({ id: eventRevisionRequests.id, eventId: eventRevisionRequests.eventId, status: eventRevisionRequests.status })
      .from(eventRevisionRequests)
      .where(eq(eventRevisionRequests.id, revisionRequestId))
      .limit(1);

    if (!request) {
      throw new Error("Event revision request not found.");
    }

    await db
      .update(eventRevisionRequests)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(eq(eventRevisionRequests.id, revisionRequestId));

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "event",
      entityId: request.eventId,
      action: "event_revision_request_resolved",
      metadata: { revisionRequestId, previousStatus: request.status },
    });

    revalidateConsumerAndAdmin();
    redirect(adminReviewRedirect("Event revision request resolved.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve event revision request.";
    redirect(adminReviewRedirect(message, "error"));
  }
}

export async function publishVenueFromAdminAction(formData: FormData) {
  try {
    const admin = await requireAdminUser();
    const venueId = asInt(formData.get("venueId"), "Venue ID");

    const [venue] = await db
      .select({ id: venues.id, publicationStatus: venues.publicationStatus })
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1);

    if (!venue) {
      throw new Error("Venue not found.");
    }

    await db
      .update(venues)
      .set({
        publicationStatus: "published",
        verificationStatus: "verified",
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venueId));

    await db.insert(venuePublishHistory).values({
      venueId,
      actorClerkUserId: admin.clerkUserId,
      action: "published",
      previousStatus: venue.publicationStatus,
      nextStatus: "published",
      notes: "Published via admin review queue",
    });

    await writeAuditLog({
      actorClerkUserId: admin.clerkUserId,
      actorRole: "admin",
      entityType: "venue",
      entityId: venueId,
      action: "venue_published",
      previousValues: { publicationStatus: venue.publicationStatus },
      nextValues: { publicationStatus: "published" },
    });

    revalidateConsumerAndAdmin(venueId);
    redirect(adminReviewRedirect("Venue published.", "success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish venue.";
    redirect(adminReviewRedirect(message, "error"));
  }
}
