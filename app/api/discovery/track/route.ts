import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { specialGuestAnalyticsDaily, specialGuests } from "@/db/schema";

const ALLOWED_EVENTS = new Set([
  "recommendation_impression",
  "recommendation_click",
  "recommendation_save",
  "recommendation_share",
  "recommendation_dismiss",
  "filter_applied",
  "city_pulse_opened",
  "live_recommendation_opened",
  "special_guest_view",
  "special_guest_click",
  "special_guest_venue_conversion",
  "special_guest_reservation_conversion",
  "special_guest_ticket_conversion",
]);

function toMetricDateText(now: Date) {
  return now.toISOString().slice(0, 10);
}

function specialGuestDelta(event: string) {
  if (event === "special_guest_view") {
    return { views: 1, clicks: 0, venueConversions: 0, reservationConversions: 0, ticketConversions: 0 };
  }

  if (event === "special_guest_click") {
    return { views: 0, clicks: 1, venueConversions: 0, reservationConversions: 0, ticketConversions: 0 };
  }

  if (event === "special_guest_venue_conversion") {
    return { views: 0, clicks: 0, venueConversions: 1, reservationConversions: 0, ticketConversions: 0 };
  }

  if (event === "special_guest_reservation_conversion") {
    return { views: 0, clicks: 0, venueConversions: 0, reservationConversions: 1, ticketConversions: 0 };
  }

  if (event === "special_guest_ticket_conversion") {
    return { views: 0, clicks: 0, venueConversions: 0, reservationConversions: 0, ticketConversions: 1 };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      event?: string;
      recommendationType?: string;
      itemId?: number | string;
      rankPosition?: number;
      explanationCategory?: string;
      activeFilters?: string[];
      specialGuestId?: number;
      revenueCents?: number;
      trafficSource?: string;
    };

    if (!payload.event || !ALLOWED_EVENTS.has(payload.event)) {
      return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
    }

    let actorClerkUserId = "anonymous";
    let actorRole = "anonymous";

    try {
      const { userId } = await auth();
      if (userId) {
        actorClerkUserId = userId;
        actorRole = "consumer";
      }
    } catch {
      // Auth context is optional for this public analytics endpoint.
    }

    const delta = specialGuestDelta(payload.event);
    if (delta && typeof payload.specialGuestId === "number" && Number.isInteger(payload.specialGuestId)) {
      const [guest] = await db
        .select({ id: specialGuests.id, venueId: specialGuests.venueId, eventId: specialGuests.eventId })
        .from(specialGuests)
        .where(eq(specialGuests.id, payload.specialGuestId))
        .limit(1);

      if (guest) {
        const revenueCents = Number.isFinite(payload.revenueCents) ? Math.max(0, Math.floor(payload.revenueCents ?? 0)) : 0;
        const trafficSource = payload.trafficSource?.trim() || "discover";
        const metricDate = toMetricDateText(new Date());

        await db
          .insert(specialGuestAnalyticsDaily)
          .values({
            specialGuestId: guest.id,
            venueId: guest.venueId,
            eventId: guest.eventId,
            metricDate,
            trafficSource,
            views: delta.views,
            clicks: delta.clicks,
            venueConversions: delta.venueConversions,
            reservationConversions: delta.reservationConversions,
            ticketConversions: delta.ticketConversions,
            revenueCents,
            popularityScore:
              delta.views +
              delta.clicks * 3 +
              delta.venueConversions * 5 +
              delta.reservationConversions * 8 +
              delta.ticketConversions * 8,
          })
          .onConflictDoUpdate({
            target: [
              specialGuestAnalyticsDaily.specialGuestId,
              specialGuestAnalyticsDaily.trafficSource,
              specialGuestAnalyticsDaily.metricDate,
            ],
            set: {
              views: sql`${specialGuestAnalyticsDaily.views} + ${delta.views}`,
              clicks: sql`${specialGuestAnalyticsDaily.clicks} + ${delta.clicks}`,
              venueConversions: sql`${specialGuestAnalyticsDaily.venueConversions} + ${delta.venueConversions}`,
              reservationConversions: sql`${specialGuestAnalyticsDaily.reservationConversions} + ${delta.reservationConversions}`,
              ticketConversions: sql`${specialGuestAnalyticsDaily.ticketConversions} + ${delta.ticketConversions}`,
              revenueCents: sql`${specialGuestAnalyticsDaily.revenueCents} + ${revenueCents}`,
              popularityScore:
                sql`${specialGuestAnalyticsDaily.views} + ${delta.views} + (${specialGuestAnalyticsDaily.clicks} + ${delta.clicks}) * 3 + (${specialGuestAnalyticsDaily.venueConversions} + ${delta.venueConversions}) * 5 + (${specialGuestAnalyticsDaily.reservationConversions} + ${delta.reservationConversions}) * 8 + (${specialGuestAnalyticsDaily.ticketConversions} + ${delta.ticketConversions}) * 8`,
              updatedAt: new Date(),
            },
          });
      }
    }

    await writeAuditLog({
      actorClerkUserId,
      actorRole,
      entityType: "discovery_recommendation",
      entityId: payload.itemId ?? "unknown",
      action: payload.event,
      metadata: {
        recommendationType: payload.recommendationType ?? null,
        rankPosition: payload.rankPosition ?? null,
        explanationCategory: payload.explanationCategory ?? null,
        activeFilters: payload.activeFilters ?? [],
        specialGuestId: payload.specialGuestId ?? null,
        revenueCents: payload.revenueCents ?? null,
        trafficSource: payload.trafficSource ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("discovery track failure", error);
    return NextResponse.json({ error: "Failed to track discovery interaction" }, { status: 500 });
  }
}
