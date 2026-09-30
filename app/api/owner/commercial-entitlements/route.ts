import { NextResponse } from "next/server";

import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import { CommercialEntitlementError, getCommercialSubscriptionStatus } from "@/lib/commercial-entitlements/service";
import { commercialErrorResponse } from "@/lib/commercial-entitlements/http";

export async function GET() {
  try {
    const owner = await getCurrentOwnerVenue();
    if (owner.role !== "owner") throw new CommercialEntitlementError("forbidden", 403);
    const status = await getCommercialSubscriptionStatus("venue", owner.venueId);
    return NextResponse.json({ ...status, venueName: owner.venue.name, customerFacingPlan: "Nightly venue package", pricing: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return commercialErrorResponse(error); }
}