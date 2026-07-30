import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { writeAuditLog } from "@/app/lib/audit-log";

const ALLOWED_EVENTS = new Set([
  "recommendation_impression",
  "recommendation_click",
  "recommendation_save",
  "recommendation_share",
  "recommendation_dismiss",
  "filter_applied",
  "city_pulse_opened",
  "live_recommendation_opened",
]);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      event?: string;
      recommendationType?: string;
      itemId?: number | string;
      rankPosition?: number;
      explanationCategory?: string;
      activeFilters?: string[];
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
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("discovery track failure", error);
    return NextResponse.json({ error: "Failed to track discovery interaction" }, { status: 500 });
  }
}
