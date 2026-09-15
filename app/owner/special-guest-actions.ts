"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { eventNotificationOutbox, events, specialGuestHistory, specialGuests } from "@/db/schema";
import {
  deriveSpecialGuestStatus,
  notificationTypesForSpecialGuestAction,
  parseSpecialGuestType,
  type SpecialGuestHistoryAction,
  type SpecialGuestStatus,
  type SpecialGuestVerificationStatus,
} from "@/lib/special-guests/service";

import { getCurrentOwnerVenue } from "./lib/ownership";

function ownerSpecialGuestsRedirect(type: "success" | "error", message: string) {
  const params = new URLSearchParams({ [type]: message });
  return `/owner/special-guests?${params.toString()}`;
}

function revalidateSpecialGuestSurfaces(venueId: number) {
  revalidatePath("/owner/special-guests");
  revalidatePath("/owner/events");
  revalidatePath("/discover");
  revalidatePath("/events");
  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/home");
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:events", "max");
  revalidateTag("consumer:venues", "max");
}

function asRequiredString(value: FormDataEntryValue | null, label: string) {
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

function asRequiredDate(value: FormDataEntryValue | null, label: string) {
  const text = asRequiredString(value, label);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return parsed;
}

function asOptionalDate(value: FormDataEntryValue | null, label: string) {
  const text = asOptionalString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return parsed;
}

function asOptionalInt(value: FormDataEntryValue | null) {
  const text = asOptionalString(value);
  if (!text) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function parseVerificationStatus(raw: string | null): SpecialGuestVerificationStatus {
  if (raw === "verified" || raw === "pending_review" || raw === "rejected" || raw === "unverified") {
    return raw;
  }
  return "unverified";
}

async function resolveNotificationEventId(input: { explicitEventId: number | null; venueId: number; appearanceStartAt: Date }) {
  if (input.explicitEventId) {
    return input.explicitEventId;
  }

  const [nextEvent] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.venueId, input.venueId), lte(events.startsAt, new Date(input.appearanceStartAt.getTime() + 48 * 60 * 60 * 1000))))
    .orderBy(asc(events.startsAt))
    .limit(1);

  return nextEvent?.id ?? null;
}

function scheduledAtForNotification(type: string, appearanceStartAt: Date, now: Date) {
  if (type === "special_guest_starting_soon") {
    const at = new Date(appearanceStartAt.getTime() - 60 * 60 * 1000);
    return at > now ? at : now;
  }

  if (type === "special_guest_reminder") {
    const at = new Date(appearanceStartAt.getTime() - 24 * 60 * 60 * 1000);
    return at > now ? at : now;
  }

  return now;
}

async function queueSpecialGuestNotifications(input: {
  action: SpecialGuestHistoryAction;
  venueId: number;
  eventId: number | null;
  appearanceStartAt: Date;
  payload: Record<string, unknown>;
}) {
  const notificationTypes = notificationTypesForSpecialGuestAction(input.action);
  if (notificationTypes.length === 0) {
    return;
  }

  const now = new Date();
  const eventId = await resolveNotificationEventId({
    explicitEventId: input.eventId,
    venueId: input.venueId,
    appearanceStartAt: input.appearanceStartAt,
  });

  if (!eventId) {
    return;
  }

  await db.insert(eventNotificationOutbox).values(
    notificationTypes.map((notificationType) => ({
      eventId,
      notificationType,
      payloadJson: JSON.stringify(input.payload),
      status: "queued",
      scheduledAt: scheduledAtForNotification(notificationType, input.appearanceStartAt, now),
    }))
  );
}

async function appendSpecialGuestHistory(input: {
  specialGuestId: number;
  venueId: number;
  eventId: number | null;
  action: SpecialGuestHistoryAction;
  actorClerkUserId: string;
  payload: Record<string, unknown>;
}) {
  await db.insert(specialGuestHistory).values({
    specialGuestId: input.specialGuestId,
    venueId: input.venueId,
    eventId: input.eventId,
    action: input.action,
    actorClerkUserId: input.actorClerkUserId,
    payloadJson: JSON.stringify(input.payload),
  });

  await writeAuditLog({
    actorClerkUserId: input.actorClerkUserId,
    actorRole: "owner",
    entityType: "special_guest",
    entityId: input.specialGuestId,
    action: input.action,
    metadata: input.payload,
  });
}

async function autoExpireSpecialGuestsForVenue(venueId: number, actorClerkUserId: string) {
  const now = new Date();
  const expiringRows = await db
    .select()
    .from(specialGuests)
    .where(
      and(
        eq(specialGuests.venueId, venueId),
        eq(specialGuests.isArchived, false),
        eq(specialGuests.isActive, true),
        isNull(specialGuests.cancelledAt),
        or(eq(specialGuests.status, "scheduled"), eq(specialGuests.status, "active")),
        lte(specialGuests.appearanceEndAt, now)
      )
    );

  for (const row of expiringRows) {
    await db
      .update(specialGuests)
      .set({
        status: "expired",
        expiredAt: now,
        updatedByClerkUserId: actorClerkUserId,
        updatedAt: now,
      })
      .where(eq(specialGuests.id, row.id));

    await appendSpecialGuestHistory({
      specialGuestId: row.id,
      venueId: row.venueId,
      eventId: row.eventId,
      action: "auto_expired",
      actorClerkUserId,
      payload: { previousStatus: row.status, nextStatus: "expired" },
    });
  }
}

async function ensureOwnerEvent(eventId: number, venueId: number) {
  const [event] = await db
    .select({ id: events.id, venueId: events.venueId })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.venueId, venueId)))
    .limit(1);

  if (!event) {
    throw new Error("Event not found for this venue.");
  }

  return event;
}

function validateTimeWindow(input: {
  appearanceStartAt: Date;
  appearanceEndAt: Date;
  visibilityStartAt: Date | null;
  visibilityEndAt: Date | null;
}) {
  if (input.appearanceEndAt <= input.appearanceStartAt) {
    throw new Error("Appearance end must be after appearance start.");
  }

  if (input.visibilityStartAt && input.visibilityEndAt && input.visibilityEndAt < input.visibilityStartAt) {
    throw new Error("Visibility end must be after visibility start.");
  }
}

function nextStatusFromPayload(input: {
  requested: SpecialGuestStatus | null;
  appearanceStartAt: Date;
  appearanceEndAt: Date;
  visibilityStartAt: Date | null;
  visibilityEndAt: Date | null;
  isActive: boolean;
  isArchived: boolean;
  cancelledAt: Date | null;
}) {
  const computed = deriveSpecialGuestStatus(
    {
      status: input.requested ?? "scheduled",
      appearanceStartAt: input.appearanceStartAt,
      appearanceEndAt: input.appearanceEndAt,
      visibilityStartAt: input.visibilityStartAt,
      visibilityEndAt: input.visibilityEndAt,
      isActive: input.isActive,
      isArchived: input.isArchived,
      cancelledAt: input.cancelledAt,
    },
    new Date()
  );

  return computed;
}

function normalizeStatus(raw: string | null): SpecialGuestStatus | null {
  if (raw === "scheduled" || raw === "active" || raw === "cancelled" || raw === "expired" || raw === "archived") {
    return raw;
  }
  return null;
}

export async function getOwnerSpecialGuestsData() {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();
  await autoExpireSpecialGuestsForVenue(venueId, clerkUserId);

  const [rows, venueEvents] = await Promise.all([
    db
      .select()
      .from(specialGuests)
      .where(eq(specialGuests.venueId, venueId))
      .orderBy(asc(specialGuests.appearanceStartAt), asc(specialGuests.id)),
    db
      .select({ id: events.id, title: events.title, startsAt: events.startsAt })
      .from(events)
      .where(eq(events.venueId, venueId))
      .orderBy(asc(events.startsAt))
      .limit(120),
  ]);

  return {
    rows,
    venueEvents,
  };
}

export async function createSpecialGuestAction(formData: FormData) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();

  try {
    const eventId = asOptionalInt(formData.get("eventId"));
    if (eventId) {
      await ensureOwnerEvent(eventId, venueId);
    }

    const displayName = asRequiredString(formData.get("displayName"), "Guest display name");
    const stageName = asOptionalString(formData.get("stageName"));
    const guestType = parseSpecialGuestType(asOptionalString(formData.get("guestType")));
    const customGuestType = asOptionalString(formData.get("customGuestType"));
    const photoUrl = asOptionalString(formData.get("photoUrl"));
    const logoUrl = asOptionalString(formData.get("logoUrl"));
    const shortDescription = asOptionalString(formData.get("shortDescription"));
    const appearanceStartAt = asRequiredDate(formData.get("appearanceStartAt"), "Appearance start");
    const appearanceEndAt = asRequiredDate(formData.get("appearanceEndAt"), "Appearance end");
    const visibilityStartAt = asOptionalDate(formData.get("visibilityStartAt"), "Visibility start");
    const visibilityEndAt = asOptionalDate(formData.get("visibilityEndAt"), "Visibility end");
    const verificationStatus = parseVerificationStatus(asOptionalString(formData.get("verificationStatus")));
    const isActive = asBoolean(formData.get("isActive"));

    validateTimeWindow({ appearanceStartAt, appearanceEndAt, visibilityStartAt, visibilityEndAt });

    const status = nextStatusFromPayload({
      requested: normalizeStatus(asOptionalString(formData.get("status"))),
      appearanceStartAt,
      appearanceEndAt,
      visibilityStartAt,
      visibilityEndAt,
      isActive,
      isArchived: false,
      cancelledAt: null,
    });

    const [created] = await db
      .insert(specialGuests)
      .values({
        venueId,
        eventId: eventId ?? null,
        displayName,
        stageName,
        guestType,
        customGuestType,
        photoUrl,
        logoUrl,
        shortDescription,
        appearanceStartAt,
        appearanceEndAt,
        visibilityStartAt,
        visibilityEndAt,
        verificationStatus,
        status,
        isActive,
        createdByClerkUserId: clerkUserId,
        updatedByClerkUserId: clerkUserId,
      })
      .returning({ id: specialGuests.id, eventId: specialGuests.eventId });

    await appendSpecialGuestHistory({
      specialGuestId: created.id,
      venueId,
      eventId: created.eventId,
      action: "created",
      actorClerkUserId: clerkUserId,
      payload: { displayName, guestType, stageName, verificationStatus, status },
    });

    await queueSpecialGuestNotifications({
      action: "created",
      venueId,
      eventId: created.eventId,
      appearanceStartAt,
      payload: { specialGuestId: created.id, venueId, eventId: created.eventId, displayName, status },
    });

    revalidateSpecialGuestSurfaces(venueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create special guest.";
    redirect(ownerSpecialGuestsRedirect("error", message));
  }

  redirect(ownerSpecialGuestsRedirect("success", "Special guest created."));
}

export async function updateSpecialGuestAction(formData: FormData) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();

  try {
    const guestId = asOptionalInt(formData.get("guestId"));
    if (!guestId) {
      throw new Error("Special guest id is required.");
    }

    const [existing] = await db
      .select()
      .from(specialGuests)
      .where(and(eq(specialGuests.id, guestId), eq(specialGuests.venueId, venueId)))
      .limit(1);

    if (!existing) {
      throw new Error("Special guest not found.");
    }

    const eventId = asOptionalInt(formData.get("eventId"));
    if (eventId) {
      await ensureOwnerEvent(eventId, venueId);
    }

    const displayName = asRequiredString(formData.get("displayName"), "Guest display name");
    const stageName = asOptionalString(formData.get("stageName"));
    const guestType = parseSpecialGuestType(asOptionalString(formData.get("guestType")));
    const customGuestType = asOptionalString(formData.get("customGuestType"));
    const photoUrl = asOptionalString(formData.get("photoUrl"));
    const logoUrl = asOptionalString(formData.get("logoUrl"));
    const shortDescription = asOptionalString(formData.get("shortDescription"));
    const appearanceStartAt = asRequiredDate(formData.get("appearanceStartAt"), "Appearance start");
    const appearanceEndAt = asRequiredDate(formData.get("appearanceEndAt"), "Appearance end");
    const visibilityStartAt = asOptionalDate(formData.get("visibilityStartAt"), "Visibility start");
    const visibilityEndAt = asOptionalDate(formData.get("visibilityEndAt"), "Visibility end");
    const verificationStatus = parseVerificationStatus(asOptionalString(formData.get("verificationStatus")));
    const requestedStatus = normalizeStatus(asOptionalString(formData.get("status")));
    const isActive = asBoolean(formData.get("isActive"));

    validateTimeWindow({ appearanceStartAt, appearanceEndAt, visibilityStartAt, visibilityEndAt });

    const status = nextStatusFromPayload({
      requested: requestedStatus,
      appearanceStartAt,
      appearanceEndAt,
      visibilityStartAt,
      visibilityEndAt,
      isActive,
      isArchived: existing.isArchived,
      cancelledAt: existing.cancelledAt,
    });

    await db
      .update(specialGuests)
      .set({
        eventId: eventId ?? null,
        displayName,
        stageName,
        guestType,
        customGuestType,
        photoUrl,
        logoUrl,
        shortDescription,
        appearanceStartAt,
        appearanceEndAt,
        visibilityStartAt,
        visibilityEndAt,
        verificationStatus,
        status,
        isActive,
        updatedByClerkUserId: clerkUserId,
        updatedAt: new Date(),
        reviewedByClerkUserId: verificationStatus !== existing.verificationStatus ? clerkUserId : existing.reviewedByClerkUserId,
        reviewedAt: verificationStatus !== existing.verificationStatus ? new Date() : existing.reviewedAt,
      })
      .where(eq(specialGuests.id, guestId));

    await appendSpecialGuestHistory({
      specialGuestId: guestId,
      venueId,
      eventId: eventId ?? null,
      action: verificationStatus !== existing.verificationStatus ? "verification_updated" : "updated",
      actorClerkUserId: clerkUserId,
      payload: {
        previousStatus: existing.status,
        nextStatus: status,
        previousVerificationStatus: existing.verificationStatus,
        nextVerificationStatus: verificationStatus,
      },
    });

    await queueSpecialGuestNotifications({
      action: verificationStatus !== existing.verificationStatus ? "verification_updated" : "updated",
      venueId,
      eventId: eventId ?? null,
      appearanceStartAt,
      payload: { specialGuestId: guestId, venueId, eventId: eventId ?? null, displayName, status },
    });

    revalidateSpecialGuestSurfaces(venueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update special guest.";
    redirect(ownerSpecialGuestsRedirect("error", message));
  }

  redirect(ownerSpecialGuestsRedirect("success", "Special guest updated."));
}

export async function duplicateSpecialGuestAction(formData: FormData) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();

  try {
    const guestId = asOptionalInt(formData.get("guestId"));
    if (!guestId) {
      throw new Error("Special guest id is required.");
    }

    const [existing] = await db
      .select()
      .from(specialGuests)
      .where(and(eq(specialGuests.id, guestId), eq(specialGuests.venueId, venueId)))
      .limit(1);

    if (!existing) {
      throw new Error("Special guest not found.");
    }

    const deltaMs = 7 * 24 * 60 * 60 * 1000;
    const appearanceStartAt = new Date(existing.appearanceStartAt.getTime() + deltaMs);
    const appearanceEndAt = new Date(existing.appearanceEndAt.getTime() + deltaMs);

    const [created] = await db
      .insert(specialGuests)
      .values({
        venueId,
        eventId: existing.eventId,
        displayName: existing.displayName,
        stageName: existing.stageName,
        guestType: existing.guestType,
        customGuestType: existing.customGuestType,
        photoUrl: existing.photoUrl,
        logoUrl: existing.logoUrl,
        shortDescription: existing.shortDescription,
        appearanceStartAt,
        appearanceEndAt,
        visibilityStartAt: existing.visibilityStartAt,
        visibilityEndAt: existing.visibilityEndAt,
        verificationStatus: "unverified",
        status: "scheduled",
        isActive: existing.isActive,
        createdByClerkUserId: clerkUserId,
        updatedByClerkUserId: clerkUserId,
      })
      .returning({ id: specialGuests.id, eventId: specialGuests.eventId, displayName: specialGuests.displayName });

    await appendSpecialGuestHistory({
      specialGuestId: created.id,
      venueId,
      eventId: created.eventId,
      action: "duplicated",
      actorClerkUserId: clerkUserId,
      payload: { sourceSpecialGuestId: existing.id },
    });

    await queueSpecialGuestNotifications({
      action: "duplicated",
      venueId,
      eventId: created.eventId,
      appearanceStartAt,
      payload: { specialGuestId: created.id, venueId, eventId: created.eventId, displayName: created.displayName, status: "scheduled" },
    });

    revalidateSpecialGuestSurfaces(venueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to duplicate special guest.";
    redirect(ownerSpecialGuestsRedirect("error", message));
  }

  redirect(ownerSpecialGuestsRedirect("success", "Special guest duplicated."));
}

export async function cancelSpecialGuestAction(formData: FormData) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();

  try {
    const guestId = asOptionalInt(formData.get("guestId"));
    if (!guestId) {
      throw new Error("Special guest id is required.");
    }

    const reason = asOptionalString(formData.get("cancelReason"));

    const [existing] = await db
      .select()
      .from(specialGuests)
      .where(and(eq(specialGuests.id, guestId), eq(specialGuests.venueId, venueId)))
      .limit(1);

    if (!existing) {
      throw new Error("Special guest not found.");
    }

    const now = new Date();
    await db
      .update(specialGuests)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledReason: reason,
        updatedByClerkUserId: clerkUserId,
        updatedAt: now,
      })
      .where(eq(specialGuests.id, guestId));

    await appendSpecialGuestHistory({
      specialGuestId: guestId,
      venueId,
      eventId: existing.eventId,
      action: "cancelled",
      actorClerkUserId: clerkUserId,
      payload: { reason },
    });

    await queueSpecialGuestNotifications({
      action: "cancelled",
      venueId,
      eventId: existing.eventId,
      appearanceStartAt: existing.appearanceStartAt,
      payload: { specialGuestId: existing.id, venueId, eventId: existing.eventId, displayName: existing.displayName, cancelledReason: reason },
    });

    revalidateSpecialGuestSurfaces(venueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel special guest.";
    redirect(ownerSpecialGuestsRedirect("error", message));
  }

  redirect(ownerSpecialGuestsRedirect("success", "Special guest cancelled."));
}

export async function archiveSpecialGuestAction(formData: FormData) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();

  try {
    const guestId = asOptionalInt(formData.get("guestId"));
    if (!guestId) {
      throw new Error("Special guest id is required.");
    }

    const [existing] = await db
      .select()
      .from(specialGuests)
      .where(and(eq(specialGuests.id, guestId), eq(specialGuests.venueId, venueId)))
      .limit(1);

    if (!existing) {
      throw new Error("Special guest not found.");
    }

    const now = new Date();
    await db
      .update(specialGuests)
      .set({
        status: "archived",
        isArchived: true,
        archivedAt: now,
        isActive: false,
        updatedByClerkUserId: clerkUserId,
        updatedAt: now,
      })
      .where(eq(specialGuests.id, guestId));

    await appendSpecialGuestHistory({
      specialGuestId: guestId,
      venueId,
      eventId: existing.eventId,
      action: "archived",
      actorClerkUserId: clerkUserId,
      payload: { previousStatus: existing.status, nextStatus: "archived" },
    });

    revalidateSpecialGuestSurfaces(venueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive special guest.";
    redirect(ownerSpecialGuestsRedirect("error", message));
  }

  redirect(ownerSpecialGuestsRedirect("success", "Special guest archived."));
}
