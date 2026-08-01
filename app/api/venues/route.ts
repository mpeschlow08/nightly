import { NextResponse } from "next/server";

import { db } from "../../../db";
import { venues } from "../../../db/schema";
import { logger } from "@/lib/platform/logger";
import { monitoring } from "@/lib/platform/error-monitoring";
import { getRequestContext } from "@/lib/platform/request-context";

export async function GET() {
  const context = await getRequestContext("/api/venues");

  try {
    const venueList = await db.select().from(venues);

    return NextResponse.json(venueList);
  } catch (error) {
    logger.error("venues_fetch_failed", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "venues_fetch",
    });

    return NextResponse.json(
      { error: "Failed to load venues" },
      { status: 500 },
    );
  }
}