import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/db";
import { platformFeedback } from "@/db/schema";
import { getRequestContext } from "@/lib/platform/request-context";
import { logger } from "@/lib/platform/logger";

export async function POST(request: Request) {
  const context = await getRequestContext("/api/feedback");
  const { userId } = await auth();

  try {
    const payload = (await request.json()) as {
      category?: string;
      severity?: string;
      route?: string;
      appVersion?: string;
      environment?: string;
      userRole?: string;
      deviceCategory?: string;
      summary?: string;
      reproductionSteps?: string;
      screenshotUrl?: string;
      consentToContact?: boolean;
    };

    const category = (payload.category ?? "general").trim();
    const summary = (payload.summary ?? "").trim();

    if (!summary) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 });
    }

    const [row] = await db
      .insert(platformFeedback)
      .values({
        category,
        severity: (payload.severity ?? "medium").trim(),
        route: payload.route?.trim() || null,
        appVersion: payload.appVersion?.trim() || null,
        environment: payload.environment?.trim() || process.env.APP_ENV || process.env.NODE_ENV || "development",
        userRole: payload.userRole?.trim() || null,
        deviceCategory: payload.deviceCategory?.trim() || null,
        summary,
        reproductionSteps: payload.reproductionSteps?.trim() || null,
        screenshotUrl: payload.screenshotUrl?.trim() || null,
        consentToContact: Boolean(payload.consentToContact),
        submittedByClerkUserId: userId ?? null,
      })
      .returning({ id: platformFeedback.id, status: platformFeedback.status });

    return NextResponse.json({ id: row.id, status: row.status }, { status: 201 });
  } catch (error) {
    logger.error("feedback_submit_failed", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json({ error: "Failed to submit feedback", requestId: context.requestId }, { status: 500 });
  }
}
