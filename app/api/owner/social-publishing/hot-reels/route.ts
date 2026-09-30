import { NextResponse } from "next/server";

import { listEligibleHotReels } from "@/lib/social-publishing/distribution-service";
import { parseVenueId, socialErrorResponse } from "../_lib/http";

export async function GET(request: Request) {
  const venueId = parseVenueId(new URL(request.url).searchParams.get("venueId"));
  if (!venueId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ hotReels: await listEligibleHotReels(venueId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
