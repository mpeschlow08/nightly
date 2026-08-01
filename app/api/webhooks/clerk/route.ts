import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { db } from "@/db";
import { webhookDeliveries } from "@/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/platform/logger";
import { monitoring } from "@/lib/platform/error-monitoring";
import { getRequestContext } from "@/lib/platform/request-context";

export async function POST(req: Request) {
  const context = await getRequestContext("/api/webhooks/clerk");
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error("clerk_webhook_secret_missing", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
    });

    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let eventType = "unknown";
  let signatureVerified = false;
  let verifiedEvent: unknown = null;

  try {
    verifiedEvent = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
    signatureVerified = true;

    if (
      typeof verifiedEvent === "object" &&
      verifiedEvent !== null &&
      "type" in verifiedEvent &&
      typeof verifiedEvent.type === "string"
    ) {
      eventType = verifiedEvent.type;
    }

    await db
      .insert(webhookDeliveries)
      .values({
        provider: "clerk",
        externalEventId: svix_id,
        eventType,
        status: "verified",
        signatureVerified,
        processedAt: new Date(),
        payloadJson: payload,
        metadataJson: JSON.stringify({
          requestId: context.requestId,
          correlationId: context.correlationId,
          timestamp: svix_timestamp,
        }),
      })
      .onConflictDoUpdate({
        target: [webhookDeliveries.provider, webhookDeliveries.externalEventId],
        set: {
          eventType,
          status: "verified",
          signatureVerified,
          processedAt: new Date(),
          payloadJson: payload,
          metadataJson: JSON.stringify({
            requestId: context.requestId,
            correlationId: context.correlationId,
            timestamp: svix_timestamp,
            replayed: true,
          }),
          attempts: sql`${webhookDeliveries.attempts} + 1`,
        },
      });

    logger.info("clerk_webhook_verified", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      svixId: svix_id,
      eventType,
    });
  } catch (error) {
    await db
      .insert(webhookDeliveries)
      .values({
        provider: "clerk",
        externalEventId: svix_id,
        eventType,
        status: "rejected",
        signatureVerified,
        payloadJson: payload,
        lastError: error instanceof Error ? error.message : "Invalid signature",
        metadataJson: JSON.stringify({
          requestId: context.requestId,
          correlationId: context.correlationId,
          timestamp: svix_timestamp,
        }),
      })
      .onConflictDoUpdate({
        target: [webhookDeliveries.provider, webhookDeliveries.externalEventId],
        set: {
          status: "rejected",
          signatureVerified,
          lastError: error instanceof Error ? error.message : "Invalid signature",
          metadataJson: JSON.stringify({
            requestId: context.requestId,
            correlationId: context.correlationId,
            timestamp: svix_timestamp,
            replayed: true,
          }),
          attempts: sql`${webhookDeliveries.attempts} + 1`,
        },
      });

    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "webhook_verify",
      provider: "clerk",
      metadata: {
        svixId: svix_id,
      },
    });

    return new Response("Invalid signature", { status: 400 });
  }

  return NextResponse.json({ received: true, eventType });
}
