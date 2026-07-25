import { NextResponse } from "next/server";

import { consumeOwnerVenueSearchRateLimit } from "@/app/api/owner/google-places/lib/search-rate-limit";
import { requireAuthorizedOwnerForVenue } from "@/app/owner/lib/authorization";
import { searchGooglePlacesVenues } from "@/app/owner/lib/google-places";

function getRateLimitKey(userId: string, request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const fallbackIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || fallbackIp || "unknown-ip";

  return `${userId}:${ip}`;
}

export async function POST(request: Request) {
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

    const rateLimitResult = consumeOwnerVenueSearchRateLimit(
      getRateLimitKey(userId, request)
    );

    if (!rateLimitResult.allowed) {
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

    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
