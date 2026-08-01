import { NextResponse } from "next/server";

import { consumeOwnerVenueSearchRateLimit } from "@/app/api/owner/google-places/lib/search-rate-limit";
import { requireAuthorizedOwnerForVenue } from "@/app/owner/lib/authorization";
import { searchGooglePlacesVenues } from "@/app/owner/lib/google-places";
import { logger } from "@/lib/platform/logger";
import { monitoring } from "@/lib/platform/error-monitoring";
import { getRequestContext } from "@/lib/platform/request-context";
import { isKillSwitchEnabled } from "@/lib/platform/kill-switches";

function getRateLimitKey(userId: string, request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const fallbackIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || fallbackIp || "unknown-ip";

  return `${userId}:${ip}`;
}

export async function POST(request: Request) {
  const context = await getRequestContext("/api/owner/google-places/search");

  try {
    const body = (await request.json()) as {
      venueId?: number;
      query?: string;
    };

    const venueId = Number.parseInt(String(body.venueId ?? ""), 10);

    if (!Number.isFinite(venueId)) {
      return NextResponse.json({ error: "Venue ID is required." }, { status: 400 });
    }

    const query = typeof body.query === "string" ? body.query : "";
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

    const rateLimitResult = consumeOwnerVenueSearchRateLimit(
      getRateLimitKey(userId, request)
    );

    if (!rateLimitResult.allowed) {
      logger.warn("owner_google_places_rate_limited", {
        requestId: context.requestId,
        correlationId: context.correlationId,
        route: context.route,
        venueId,
        userId,
      });

      return NextResponse.json(
        { error: "Too many searches. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
          },
        }
      );
    }

    const results = await searchGooglePlacesVenues({
      query,
      venueCity: venue.city,
      venueLatitude: venue.latitude,
      venueLongitude: venue.longitude,
    });

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";

    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "owner_google_places_search",
      provider: "google_places",
    });

    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
