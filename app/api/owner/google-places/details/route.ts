import { NextResponse } from "next/server";

import { requireAuthorizedOwnerForVenue } from "@/app/owner/lib/authorization";
import { getGooglePlaceVenueDetails } from "@/app/owner/lib/google-places";
import { monitoring } from "@/lib/platform/error-monitoring";
import { getRequestContext } from "@/lib/platform/request-context";
import { isKillSwitchEnabled } from "@/lib/platform/kill-switches";

export async function POST(request: Request) {
  const context = await getRequestContext("/api/owner/google-places/details");

  try {
    const body = (await request.json()) as {
      venueId?: number;
      placeId?: string;
    };

    const venueId = Number.parseInt(String(body.venueId ?? ""), 10);

    if (!Number.isFinite(venueId)) {
      return NextResponse.json({ error: "Venue ID is required." }, { status: 400 });
    }

    const { userId, venue } = await requireAuthorizedOwnerForVenue(venueId);

    const importsDisabled = await isKillSwitchEnabled("google_places_imports", {
      userId,
      role: "owner",
      venueId: String(venueId),
      city: venue.city ?? undefined,
    });

    if (importsDisabled) {
      return NextResponse.json(
        { error: "Google Places imports are temporarily disabled." },
        { status: 503 }
      );
    }

    if (typeof body.placeId !== "string" || !body.placeId.trim()) {
      return NextResponse.json({ error: "Google place ID is required." }, { status: 400 });
    }

    const details = await getGooglePlaceVenueDetails(body.placeId, {
      correlationId: context.correlationId,
    });

    return NextResponse.json({ details });
  } catch (error) {
    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "owner_google_places_details",
      provider: "google_places",
    });

    const message = error instanceof Error ? error.message : "Details request failed.";

    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("failed") || message.includes("timeout")) {
      return NextResponse.json(
        { error: "Google Places is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
