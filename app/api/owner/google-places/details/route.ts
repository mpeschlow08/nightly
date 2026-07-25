import { NextResponse } from "next/server";

import { requireAuthorizedOwnerForVenue } from "@/app/owner/lib/authorization";
import { getGooglePlaceVenueDetails } from "@/app/owner/lib/google-places";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      venueId?: number;
      placeId?: string;
    };

    const venueId = Number.parseInt(String(body.venueId ?? ""), 10);

    if (!Number.isFinite(venueId)) {
      return NextResponse.json({ error: "Venue ID is required." }, { status: 400 });
    }

    await requireAuthorizedOwnerForVenue(venueId);

    if (typeof body.placeId !== "string" || !body.placeId.trim()) {
      return NextResponse.json({ error: "Google place ID is required." }, { status: 400 });
    }

    const details = await getGooglePlaceVenueDetails(body.placeId);

    return NextResponse.json({ details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Details request failed.";

    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
