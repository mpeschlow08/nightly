"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import {
  eventAnalyticsDaily,
  eventLineup,
  eventModerationFlags,
  eventNotificationOutbox,
  eventRecurrenceInstances,
  eventRevisionRequests,
  events,
} from "@/db/schema";

import { getCurrentOwnerVenue } from "./lib/ownership";

type EventLifecycleStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "live"
  | "completed"
  | "cancelled"
  | "archived";

type EventNotificationType =
  | "event_published"
  | "event_updated"
  | "event_cancelled"
  | "lineup_changed"
  | "guest_list_open"
  | "ticket_sales_live";

type EditableEvent = Partial<typeof events.$inferInsert>;

function ownerEventsRedirect(type: "success" | "error", message: string) {
  const params = new URLSearchParams({ [type]: message });
  return `/owner/events?${params.toString()}`;
}

function revalidateEventSurfaces(venueId: number) {
  revalidatePath("/owner/events");
  revalidatePath("/home");
  revalidatePath("/discover");
  revalidatePath("/live");
  revalidatePath("/events");
  revalidatePath(`/venues/${venueId}`);
  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
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

function asOptionalDate(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return date;
}

function asRequiredDate(value: FormDataEntryValue | null, label: string) {
  const date = asOptionalDate(value, label);
  if (!date) {
    throw new Error(`${label} is required.`);
  }
  return date;
}

function asOptionalInt(value: FormDataEntryValue | null, label: string, min?: number, max?: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (typeof min === "number" && parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }
  if (typeof max === "number" && parsed > max) {
    throw new Error(`${label} must be at most ${max}.`);
  }
  return parsed;
}

function asCurrencyCents(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return Math.round(parsed * 100);
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function asOptionalUrl(value: FormDataEntryValue | null, label: string) {
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

function normalizeEventType(value: FormDataEntryValue | null): "event" | "special" | "guest_list" | "reservation" {
  const text = asRequiredString(value, "Event type").toLowerCase();
  const allowed = new Set(["event", "special", "guest_list", "reservation"]);
  if (!allowed.has(text)) {
    throw new Error("Event type must be event, special, guest_list, or reservation.");
  }
  return text as "event" | "special" | "guest_list" | "reservation";
}

function normalizeVisibility(value: FormDataEntryValue | null) {
  const text = asRequiredString(value, "Visibility").toLowerCase();
  const allowed = new Set(["public", "unlisted", "private"]);
  if (!allowed.has(text)) {
    throw new Error("Visibility must be public, unlisted, or private.");
  }
  return text;
}

function normalizeLifecycleStatus(value: FormDataEntryValue | null): EventLifecycleStatus {
  const text = asRequiredString(value, "Status").toLowerCase();
  const allowed = new Set(["draft", "scheduled", "published", "live", "completed", "cancelled", "archived"]);
  if (!allowed.has(text)) {
    throw new Error("Invalid lifecycle status.");
  }
  return text as EventLifecycleStatus;
}

function parseList(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  const items = text
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? JSON.stringify(items) : null;
}

function parseOptionalJsonObject(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return JSON.stringify(parsed);
  } catch {
    throw new Error(`${label} must be valid JSON object.`);
  }
}

function toTimeText(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function computeLifecycleStatus(input: {
  requested: EventLifecycleStatus;
  startsAt: Date;
  endsAt: Date | null;
  isPublished: boolean;
}) {
  const now = new Date();

  if (input.requested === "cancelled" || input.requested === "archived" || input.requested === "draft") {
    return input.requested;
  }

  if (input.endsAt && now >= input.endsAt) {
    return "completed";
  }

  if (now >= input.startsAt && (!input.endsAt || now < input.endsAt)) {
    return "live";
  }

  if (!input.isPublished) {
    return "scheduled";
  }

  return input.requested === "scheduled" ? "scheduled" : "published";
}

async function queueEventNotification(eventId: number, notificationType: EventNotificationType, payload: Record<string, unknown>) {
  await db.insert(eventNotificationOutbox).values({
    eventId,
    notificationType,
    payloadJson: JSON.stringify(payload),
    status: "queued",
  });
}

async function ensureOwnerEvent(eventId: number) {
  const { venueId, clerkUserId } = await getCurrentOwnerVenue();
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.venueId, venueId)))
    .limit(1);

  if (!event) {
    throw new Error("Event not found or not owned by your venue.");
  }

  return { event, venueId, clerkUserId };
}

function buildEventPayload(formData: FormData, existing?: typeof events.$inferSelect): {
  values: EditableEvent & {
    startsAt: Date;
    endsAt: Date | null;
    eventDate: Date;
    startTime: string;
    endTime: string | null;
  };
  lifecycleStatus: EventLifecycleStatus;
} {
  const title = asRequiredString(formData.get("title"), "Title");
  const subtitle = asRequiredString(formData.get("subtitle"), "Subtitle");
  const description = asOptionalString(formData.get("description"));
  const startsAt = asRequiredDate(formData.get("startsAt"), "Start date/time");
  const endsAt = asOptionalDate(formData.get("endsAt"), "End date/time");
  const doorsOpenAt = asOptionalDate(formData.get("doorsOpenAt"), "Doors open");
  const heroArtworkUrl = asOptionalUrl(formData.get("coverImageUrl"), "Hero artwork");
  if (!heroArtworkUrl) {
    throw new Error("Hero artwork is required.");
  }

  if (endsAt && endsAt <= startsAt) {
    throw new Error("End date/time must be after start date/time.");
  }

  const ticketUrl = asOptionalUrl(formData.get("ticketUrl"), "Ticket link");
  const guestListUrl = asOptionalUrl(formData.get("guestListUrl"), "Guest list link");
  const reservationUrl = asOptionalUrl(formData.get("reservationUrl"), "Reservation link");
  const tableReservationUrl = asOptionalUrl(formData.get("tableReservationUrl"), "Table reservations link");
  const vipReservationUrl = asOptionalUrl(formData.get("vipReservationUrl"), "VIP reservations link");
  const bottleServiceUrl = asOptionalUrl(formData.get("bottleServiceUrl"), "Bottle service link");
  const rsvpUrl = asOptionalUrl(formData.get("rsvpUrl"), "RSVP link");

  const eventType = normalizeEventType(formData.get("eventType"));
  const visibility = normalizeVisibility(formData.get("visibility"));
  const requestedStatus = normalizeLifecycleStatus(formData.get("lifecycleStatus"));

  const isRecurring = asBoolean(formData.get("isRecurring"));
  const recurrenceType = asOptionalString(formData.get("recurrenceType"));
  const recurrenceRule = asOptionalString(formData.get("recurrenceRule"));
  const recurrenceInterval = asOptionalInt(formData.get("recurrenceInterval"), "Recurrence interval", 1, 365);
  const recurrenceDayOfMonth = asOptionalInt(formData.get("recurrenceDayOfMonth"), "Recurrence day of month", 1, 31);
  const recurrenceEndsAt = asOptionalDate(formData.get("recurrenceEndsAt"), "Recurrence end");
  const recurrenceWeekdaysJson = parseList(formData.get("recurrenceWeekdays"));
  const recurrenceExceptionDatesJson = parseList(formData.get("recurrenceExceptionDates"));
  const recurrenceHolidayOverridesJson = parseOptionalJsonObject(formData.get("recurrenceHolidayOverrides"), "Holiday overrides");

  const genresJson = parseList(formData.get("genres"));
  const genre = typeof formData.get("genres") === "string" ? String(formData.get("genres")).split(/\r?\n|,/)[0]?.trim() ?? null : null;

  const galleryImagesJson = parseList(formData.get("galleryImages"));
  const flyerImageUrlsJson = parseList(formData.get("flyerImages"));
  const promoVideoUrlsJson = parseList(formData.get("promoVideos"));
  const importedVenueImageUrlsJson = parseList(formData.get("importedVenueImages"));
  const ownerUploadedImageUrlsJson = parseList(formData.get("ownerUploadedImages"));

  const capacity = asOptionalInt(formData.get("capacity"), "Capacity", 1, 1000000);
  const ageRequirement = asOptionalInt(formData.get("ageRequirement"), "Age requirement", 0, 25);
  const dressCode = asOptionalString(formData.get("dressCode"));
  const specialDetails = asOptionalString(formData.get("specialDetails"));
  const coverCents = asCurrencyCents(formData.get("coverCharge"), "Cover charge");
  const isFeatured = asBoolean(formData.get("isFeatured"));

  const publishedToggle = asBoolean(formData.get("isPublished"));
  const moderationRequired = process.env.EVENT_APPROVAL_REQUIRED === "true";
  const approvalStatus = moderationRequired ? "pending" : "approved";
  const isPublished = moderationRequired ? false : publishedToggle;
  const publicationStatus = isPublished ? "published" : moderationRequired ? "pending_review" : "draft";

  const lifecycleStatus = computeLifecycleStatus({
    requested: requestedStatus,
    startsAt,
    endsAt,
    isPublished,
  });

  const now = new Date();

  return {
    values: {
      venueId: existing?.venueId,
      slug: existing?.slug ?? null,
      title,
      subtitle,
      description,
      eventDate: startsAt,
      startTime: toTimeText(startsAt),
      endTime: endsAt ? toTimeText(endsAt) : null,
      startsAt,
      endsAt,
      timezone: existing?.timezone ?? "America/New_York",
      coverImageUrl: heroArtworkUrl,
      galleryImagesJson,
      flyerImageUrlsJson,
      promoVideoUrlsJson,
      importedVenueImageUrlsJson,
      ownerUploadedImageUrlsJson,
      ticketUrl,
      guestListUrl,
      reservationUrl,
      tableReservationUrl,
      vipReservationUrl,
      bottleServiceUrl,
      rsvpUrl,
      eventType,
      recurrenceRule,
      recurrenceType,
      recurrenceInterval,
      recurrenceWeekdaysJson,
      recurrenceDayOfMonth,
      recurrenceEndsAt,
      recurrenceExceptionDatesJson,
      recurrenceHolidayOverridesJson,
      specialDetails,
      ticketStatus: existing?.ticketStatus ?? "on_sale",
      coverCents,
      ageRequirement,
      genre,
      genresJson,
      dressCode,
      capacity,
      doorsOpenAt,
      isFeatured,
      featuredStatus: isFeatured ? "featured" : "none",
      is21Plus: (ageRequirement ?? 0) >= 21,
      visibility,
      isRecurring,
      scheduledFor: lifecycleStatus === "scheduled" ? startsAt : null,
      publishedAt: lifecycleStatus === "published" || lifecycleStatus === "live" ? now : existing?.publishedAt ?? null,
      completedAt: lifecycleStatus === "completed" ? now : null,
      cancelledAt: lifecycleStatus === "cancelled" ? now : null,
      archivedAt: lifecycleStatus === "archived" ? now : null,
      isPublished,
      publicationStatus,
      approvalStatus,
      isCanceled: lifecycleStatus === "cancelled",
      isArchived: lifecycleStatus === "archived",
    },
    lifecycleStatus,
  };
}

async function maybeGenerateRecurrenceFromTemplate(sourceEventId: number) {
  const [sourceEvent] = await db
    .select()
    .from(events)
    .where(eq(events.id, sourceEventId))
    .limit(1);

  if (!sourceEvent?.isRecurring) {
    return 0;
  }

  const interval = sourceEvent.recurrenceInterval ?? 1;
  const type = sourceEvent.recurrenceType ?? "weekly";
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 3);

  const exceptions = new Set<string>();
  if (sourceEvent.recurrenceExceptionDatesJson) {
    try {
      const parsed = JSON.parse(sourceEvent.recurrenceExceptionDatesJson) as string[];
      parsed.forEach((d) => exceptions.add(d));
    } catch {
      // Ignore malformed stored values.
    }
  }

  const existing = await db
    .select({ occurrenceDate: eventRecurrenceInstances.occurrenceDate })
    .from(eventRecurrenceInstances)
    .where(eq(eventRecurrenceInstances.sourceEventId, sourceEventId));
  const existingSet = new Set(existing.map((row) => row.occurrenceDate.toISOString()));

  const createdIds: number[] = [];
  const cursor = new Date(sourceEvent.startsAt);

  for (let i = 0; i < 32; i += 1) {
    if (type === "weekly") {
      cursor.setDate(cursor.getDate() + 7 * interval);
    } else if (type === "monthly") {
      cursor.setMonth(cursor.getMonth() + interval);
    } else {
      cursor.setDate(cursor.getDate() + interval);
    }

    if (cursor > horizon) {
      break;
    }

    const dayIso = cursor.toISOString().slice(0, 10);
    if (exceptions.has(dayIso)) {
      continue;
    }

    const key = cursor.toISOString();
    if (existingSet.has(key)) {
      continue;
    }

    const duration = sourceEvent.endsAt ? sourceEvent.endsAt.getTime() - sourceEvent.startsAt.getTime() : null;
    const instanceEndsAt = duration ? new Date(cursor.getTime() + duration) : null;

    const [created] = await db
      .insert(events)
      .values({
        venueId: sourceEvent.venueId,
        slug: null,
        title: sourceEvent.title,
        subtitle: sourceEvent.subtitle,
        description: sourceEvent.description,
        eventDate: cursor,
        startTime: toTimeText(cursor),
        endTime: instanceEndsAt ? toTimeText(instanceEndsAt) : null,
        startsAt: cursor,
        endsAt: instanceEndsAt,
        timezone: sourceEvent.timezone,
        coverImageUrl: sourceEvent.coverImageUrl,
        galleryImagesJson: sourceEvent.galleryImagesJson,
        flyerImageUrlsJson: sourceEvent.flyerImageUrlsJson,
        promoVideoUrlsJson: sourceEvent.promoVideoUrlsJson,
        importedVenueImageUrlsJson: sourceEvent.importedVenueImageUrlsJson,
        ownerUploadedImageUrlsJson: sourceEvent.ownerUploadedImageUrlsJson,
        ticketUrl: sourceEvent.ticketUrl,
        guestListUrl: sourceEvent.guestListUrl,
        reservationUrl: sourceEvent.reservationUrl,
        tableReservationUrl: sourceEvent.tableReservationUrl,
        vipReservationUrl: sourceEvent.vipReservationUrl,
        bottleServiceUrl: sourceEvent.bottleServiceUrl,
        rsvpUrl: sourceEvent.rsvpUrl,
        eventType: sourceEvent.eventType,
        recurrenceRule: sourceEvent.recurrenceRule,
        recurrenceType: sourceEvent.recurrenceType,
        recurrenceInterval: sourceEvent.recurrenceInterval,
        recurrenceWeekdaysJson: sourceEvent.recurrenceWeekdaysJson,
        recurrenceDayOfMonth: sourceEvent.recurrenceDayOfMonth,
        recurrenceEndsAt: sourceEvent.recurrenceEndsAt,
        recurrenceExceptionDatesJson: sourceEvent.recurrenceExceptionDatesJson,
        recurrenceHolidayOverridesJson: sourceEvent.recurrenceHolidayOverridesJson,
        specialDetails: sourceEvent.specialDetails,
        ticketStatus: sourceEvent.ticketStatus,
        coverCents: sourceEvent.coverCents,
        ageRequirement: sourceEvent.ageRequirement,
        genre: sourceEvent.genre,
        genresJson: sourceEvent.genresJson,
        dressCode: sourceEvent.dressCode,
        capacity: sourceEvent.capacity,
        doorsOpenAt: sourceEvent.doorsOpenAt,
        isFeatured: false,
        featuredStatus: "none",
        is21Plus: sourceEvent.is21Plus,
        visibility: sourceEvent.visibility,
        isRecurring: false,
        lifecycleStatus: "scheduled",
        scheduledFor: cursor,
        publishedAt: null,
        completedAt: null,
        cancelledAt: null,
        archivedAt: null,
        isPublished: false,
        publicationStatus: "draft",
        approvalStatus: sourceEvent.approvalStatus,
        isCanceled: false,
        isArchived: false,
      })
      .returning({ id: events.id });

    await db.insert(eventRecurrenceInstances).values({
      sourceEventId,
      instanceEventId: created.id,
      occurrenceDate: cursor,
    });

    createdIds.push(created.id);
  }

  return createdIds.length;
}

async function cloneLineup(sourceEventId: number, targetEventId: number) {
  const lineupRows = await db
    .select()
    .from(eventLineup)
    .where(eq(eventLineup.eventId, sourceEventId))
    .orderBy(asc(eventLineup.sortOrder), asc(eventLineup.id));

  if (lineupRows.length === 0) {
    return;
  }

  await db.insert(eventLineup).values(
    lineupRows.map((row) => ({
      eventId: targetEventId,
      djProfileId: row.djProfileId,
      guestDjName: row.guestDjName,
      performanceStartsAt: row.performanceStartsAt,
      performanceEndsAt: row.performanceEndsAt,
      isFeaturedDj: row.isFeaturedDj,
      sortOrder: row.sortOrder,
    }))
  );
}

export async function createManagedOwnerEventAction(formData: FormData) {
  try {
    const { venueId, clerkUserId } = await getCurrentOwnerVenue();
    const { values, lifecycleStatus } = buildEventPayload(formData);

    const [created] = await db
      .insert(events)
      .values({
        ...values,
        venueId,
        lifecycleStatus,
      } as typeof events.$inferInsert)
      .returning({ id: events.id, title: events.title });

    await queueEventNotification(created.id, values.isPublished ? "event_published" : "event_updated", {
      eventId: created.id,
      title: created.title,
      venueId,
      lifecycleStatus,
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: created.id,
      action: "event_created",
      nextValues: { ...values, lifecycleStatus },
    });

    await maybeGenerateRecurrenceFromTemplate(created.id);

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event created."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function updateManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);
    const { values, lifecycleStatus } = buildEventPayload(formData, event);

    await db
      .update(events)
      .set({
        ...values,
        lifecycleStatus,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await queueEventNotification(eventId, "event_updated", {
      eventId,
      title: values.title,
      venueId,
      lifecycleStatus,
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_updated",
      previousValues: {
        title: event.title,
        subtitle: event.subtitle,
        lifecycleStatus: event.lifecycleStatus,
        isPublished: event.isPublished,
      },
      nextValues: {
        title: values.title,
        subtitle: values.subtitle,
        lifecycleStatus,
        isPublished: values.isPublished,
      },
    });

    await maybeGenerateRecurrenceFromTemplate(eventId);

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event updated."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function duplicateManagedOwnerEventAction(formData: FormData) {
  try {
    const sourceEventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const newStartsAt = asRequiredDate(formData.get("duplicateStartsAt"), "Duplicate start date/time");
    const newEndsAt = asOptionalDate(formData.get("duplicateEndsAt"), "Duplicate end date/time");

    const { event: sourceEvent, venueId, clerkUserId } = await ensureOwnerEvent(sourceEventId);

    const [created] = await db
      .insert(events)
      .values({
        venueId,
        slug: null,
        title: `${sourceEvent.title} (Copy)`,
        subtitle: sourceEvent.subtitle,
        description: sourceEvent.description,
        eventDate: newStartsAt,
        startTime: toTimeText(newStartsAt),
        endTime: newEndsAt ? toTimeText(newEndsAt) : null,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        timezone: sourceEvent.timezone,
        coverImageUrl: sourceEvent.coverImageUrl,
        galleryImagesJson: sourceEvent.galleryImagesJson,
        flyerImageUrlsJson: sourceEvent.flyerImageUrlsJson,
        promoVideoUrlsJson: sourceEvent.promoVideoUrlsJson,
        importedVenueImageUrlsJson: sourceEvent.importedVenueImageUrlsJson,
        ownerUploadedImageUrlsJson: sourceEvent.ownerUploadedImageUrlsJson,
        ticketUrl: sourceEvent.ticketUrl,
        guestListUrl: sourceEvent.guestListUrl,
        reservationUrl: sourceEvent.reservationUrl,
        tableReservationUrl: sourceEvent.tableReservationUrl,
        vipReservationUrl: sourceEvent.vipReservationUrl,
        bottleServiceUrl: sourceEvent.bottleServiceUrl,
        rsvpUrl: sourceEvent.rsvpUrl,
        eventType: sourceEvent.eventType,
        recurrenceRule: sourceEvent.recurrenceRule,
        recurrenceType: sourceEvent.recurrenceType,
        recurrenceInterval: sourceEvent.recurrenceInterval,
        recurrenceWeekdaysJson: sourceEvent.recurrenceWeekdaysJson,
        recurrenceDayOfMonth: sourceEvent.recurrenceDayOfMonth,
        recurrenceEndsAt: sourceEvent.recurrenceEndsAt,
        recurrenceExceptionDatesJson: sourceEvent.recurrenceExceptionDatesJson,
        recurrenceHolidayOverridesJson: sourceEvent.recurrenceHolidayOverridesJson,
        specialDetails: sourceEvent.specialDetails,
        ticketStatus: sourceEvent.ticketStatus,
        coverCents: sourceEvent.coverCents,
        ageRequirement: sourceEvent.ageRequirement,
        genre: sourceEvent.genre,
        genresJson: sourceEvent.genresJson,
        dressCode: sourceEvent.dressCode,
        capacity: sourceEvent.capacity,
        doorsOpenAt: sourceEvent.doorsOpenAt,
        isFeatured: sourceEvent.isFeatured,
        featuredStatus: sourceEvent.featuredStatus,
        is21Plus: sourceEvent.is21Plus,
        visibility: sourceEvent.visibility,
        isRecurring: sourceEvent.isRecurring,
        lifecycleStatus: "scheduled",
        scheduledFor: newStartsAt,
        publishedAt: null,
        completedAt: null,
        cancelledAt: null,
        archivedAt: null,
        isPublished: false,
        publicationStatus: "draft",
        approvalStatus: sourceEvent.approvalStatus,
        isCanceled: false,
        isArchived: false,
      })
      .returning({ id: events.id, title: events.title });

    await cloneLineup(sourceEventId, created.id);

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: created.id,
      action: "event_duplicated",
      metadata: { sourceEventId },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event duplicated."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to duplicate event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function deleteManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const confirmDelete = asRequiredString(formData.get("confirmDelete"), "Delete confirmation");
    if (confirmDelete !== "yes") {
      throw new Error("Please confirm deletion before removing event.");
    }

    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db.delete(events).where(eq(events.id, eventId));

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_deleted",
      previousValues: { title: event.title, lifecycleStatus: event.lifecycleStatus },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event deleted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function publishManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    if (event.approvalStatus !== "approved" && process.env.EVENT_APPROVAL_REQUIRED === "true") {
      throw new Error("Event requires admin approval before publishing.");
    }

    const lifecycleStatus = computeLifecycleStatus({
      requested: "published",
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      isPublished: true,
    });

    await db
      .update(events)
      .set({
        isPublished: true,
        publicationStatus: "published",
        lifecycleStatus,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await queueEventNotification(eventId, "event_published", {
      eventId,
      title: event.title,
      venueId,
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_published",
      previousValues: { isPublished: event.isPublished, lifecycleStatus: event.lifecycleStatus },
      nextValues: { isPublished: true, lifecycleStatus },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event published."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function unpublishManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db
      .update(events)
      .set({
        isPublished: false,
        publicationStatus: "draft",
        lifecycleStatus: "draft",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_unpublished",
      previousValues: { isPublished: event.isPublished, lifecycleStatus: event.lifecycleStatus },
      nextValues: { isPublished: false, lifecycleStatus: "draft" },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event moved to draft."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unpublish event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function archiveManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db
      .update(events)
      .set({
        lifecycleStatus: "archived",
        isArchived: true,
        archivedAt: new Date(),
        isPublished: false,
        publicationStatus: "draft",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_archived",
      previousValues: { lifecycleStatus: event.lifecycleStatus },
      nextValues: { lifecycleStatus: "archived" },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event archived."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function cancelManagedOwnerEventAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db
      .update(events)
      .set({
        lifecycleStatus: "cancelled",
        isCanceled: true,
        cancelledAt: new Date(),
        isPublished: false,
        publicationStatus: "draft",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await queueEventNotification(eventId, "event_cancelled", {
      eventId,
      title: event.title,
      venueId,
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_cancelled",
      previousValues: { lifecycleStatus: event.lifecycleStatus },
      nextValues: { lifecycleStatus: "cancelled" },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Event cancelled."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function requestEventRevisionAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const notes = asRequiredString(formData.get("notes"), "Revision notes");
    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db.insert(eventRevisionRequests).values({
      eventId,
      requestedByClerkUserId: clerkUserId,
      notes,
      status: "open",
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_revision_requested",
      metadata: { notes },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Revision request submitted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit revision request.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function flagEventContentAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const reason = asRequiredString(formData.get("reason"), "Flag reason");
    const notes = asOptionalString(formData.get("notes"));
    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db.insert(eventModerationFlags).values({
      eventId,
      flaggedByClerkUserId: clerkUserId,
      reason,
      notes,
      status: "open",
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_flagged",
      metadata: { reason, notes },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Content flag submitted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to flag event.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function addEventLineupSlotAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const guestDjName = asOptionalString(formData.get("guestDjName"));
    const djProfileId = asOptionalInt(formData.get("djProfileId"), "DJ profile ID", 1);
    const performanceStartsAt = asOptionalDate(formData.get("performanceStartsAt"), "Performance start");
    const performanceEndsAt = asOptionalDate(formData.get("performanceEndsAt"), "Performance end");
    const isFeaturedDj = asBoolean(formData.get("isFeaturedDj"));

    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    const [maxOrderRow] = await db
      .select({ sortOrder: eventLineup.sortOrder })
      .from(eventLineup)
      .where(eq(eventLineup.eventId, eventId))
      .orderBy(desc(eventLineup.sortOrder), desc(eventLineup.id))
      .limit(1);

    const sortOrder = typeof maxOrderRow?.sortOrder === "number" ? maxOrderRow.sortOrder + 1 : 0;

    await db.insert(eventLineup).values({
      eventId,
      djProfileId,
      guestDjName,
      performanceStartsAt,
      performanceEndsAt,
      isFeaturedDj,
      sortOrder,
    });

    await queueEventNotification(eventId, "lineup_changed", { eventId });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_lineup_slot_added",
      metadata: { guestDjName, djProfileId },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Lineup slot added."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add lineup slot.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function reorderEventLineupAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const orderedIdsRaw = asRequiredString(formData.get("orderedLineupIds"), "Lineup order");

    const orderedIds = orderedIdsRaw
      .split(",")
      .map((id) => Number.parseInt(id.trim(), 10))
      .filter((id) => Number.isInteger(id));

    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    const existing = await db
      .select({ id: eventLineup.id })
      .from(eventLineup)
      .where(eq(eventLineup.eventId, eventId));

    const existingSet = new Set(existing.map((row) => row.id));
    if (orderedIds.length !== existingSet.size || orderedIds.some((id) => !existingSet.has(id))) {
      throw new Error("Invalid lineup order payload.");
    }

    await Promise.all(
      orderedIds.map((lineupId, index) =>
        db
          .update(eventLineup)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(eventLineup.id, lineupId), eq(eventLineup.eventId, eventId)))
      )
    );

    await queueEventNotification(eventId, "lineup_changed", { eventId });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_lineup_reordered",
      metadata: { orderedIds },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Lineup order updated."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder lineup.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function removeEventLineupSlotAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const lineupId = Number.parseInt(asRequiredString(formData.get("lineupId"), "Lineup ID"), 10);

    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    await db.delete(eventLineup).where(and(eq(eventLineup.id, lineupId), eq(eventLineup.eventId, eventId)));

    const lineupRows = await db
      .select({ id: eventLineup.id })
      .from(eventLineup)
      .where(eq(eventLineup.eventId, eventId))
      .orderBy(asc(eventLineup.sortOrder), asc(eventLineup.id));

    await Promise.all(
      lineupRows.map((row, index) =>
        db.update(eventLineup).set({ sortOrder: index, updatedAt: new Date() }).where(eq(eventLineup.id, row.id))
      )
    );

    await queueEventNotification(eventId, "lineup_changed", { eventId });

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_lineup_slot_removed",
      metadata: { lineupId },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Lineup slot removed."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove lineup slot.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function generateRecurringEventsAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { event, venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    if (!event.isRecurring) {
      throw new Error("Recurring generation is only available for recurring templates.");
    }

    const createdCount = await maybeGenerateRecurrenceFromTemplate(eventId);

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_recurrence_generated",
      metadata: { createdCount },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", `Generated ${createdCount} recurring events.`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate recurring events.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function seedEventAnalyticsAction(formData: FormData) {
  try {
    const eventId = Number.parseInt(asRequiredString(formData.get("eventId"), "Event ID"), 10);
    const { venueId, clerkUserId } = await ensureOwnerEvent(eventId);

    const days = 7;
    const now = new Date();
    const rows: Array<typeof eventAnalyticsDaily.$inferInsert> = [];

    for (let i = 0; i < days; i += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);

      rows.push({
        eventId,
        metricDate: date,
        trafficSource: "direct",
        views: 20 + i,
        favorites: 5 + (i % 3),
        shares: 2 + (i % 2),
        guestListRequests: 3 + (i % 2),
        reservationRequests: 1 + (i % 2),
        ticketClicks: 7 + i,
      });
      rows.push({
        eventId,
        metricDate: date,
        trafficSource: "search",
        views: 10 + i,
        favorites: 2 + (i % 2),
        shares: 1,
        guestListRequests: 1,
        reservationRequests: 1,
        ticketClicks: 4 + i,
      });
    }

    const existing = await db
      .select({ id: eventAnalyticsDaily.id })
      .from(eventAnalyticsDaily)
      .where(eq(eventAnalyticsDaily.eventId, eventId));

    if (existing.length === 0) {
      await db.insert(eventAnalyticsDaily).values(rows);
    }

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "event",
      entityId: eventId,
      action: "event_analytics_seeded",
      metadata: { rows: rows.length },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", "Analytics dataset prepared."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare analytics.";
    redirect(ownerEventsRedirect("error", message));
  }
}

export async function runEventLifecycleAutoTransitionAction() {
  try {
    const { venueId, clerkUserId } = await getCurrentOwnerVenue();
    const now = new Date();

    const venueEvents = await db.select().from(events).where(eq(events.venueId, venueId));

    let changed = 0;

    for (const event of venueEvents) {
      if (event.lifecycleStatus === "archived" || event.lifecycleStatus === "cancelled" || event.lifecycleStatus === "draft") {
        continue;
      }

      let next: EventLifecycleStatus = event.lifecycleStatus;
      if (event.endsAt && now >= event.endsAt) {
        next = "completed";
      } else if (now >= event.startsAt && (!event.endsAt || now < event.endsAt)) {
        next = "live";
      } else if (event.isPublished) {
        next = "published";
      } else {
        next = "scheduled";
      }

      if (next !== event.lifecycleStatus) {
        changed += 1;
        await db
          .update(events)
          .set({ lifecycleStatus: next, completedAt: next === "completed" ? now : event.completedAt, updatedAt: now })
          .where(eq(events.id, event.id));
      }
    }

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      actorRole: "owner",
      entityType: "venue",
      entityId: venueId,
      action: "event_lifecycle_auto_transition",
      metadata: { changed },
    });

    revalidateEventSurfaces(venueId);
    redirect(ownerEventsRedirect("success", `Auto-transition complete. Updated ${changed} events.`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run lifecycle transitions.";
    redirect(ownerEventsRedirect("error", message));
  }
}
