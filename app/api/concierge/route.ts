import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { writeAuditLog } from "@/app/lib/audit-log";
import { getExploreData, getHomeData } from "@/lib/consumer/data";
import { db } from "@/db";
import { conciergeMessages, conciergeThreads } from "@/db/schema";
import {
  buildConciergeRecommendations,
  buildConciergeWelcomeMessage,
  conciergeStarterPrompts,
} from "@/lib/concierge/service";
import { logger } from "@/lib/platform/logger";
import { monitoring } from "@/lib/platform/error-monitoring";
import { getRequestContext } from "@/lib/platform/request-context";
import { isKillSwitchEnabled } from "@/lib/platform/kill-switches";
import type {
  ConciergeApiPayload,
  ConciergeMessageMetadata,
  ConciergeThreadMessage,
  ConciergeThreadPayload,
} from "@/lib/concierge/types";

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseMetadata(value: string | null | undefined): ConciergeMessageMetadata {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as ConciergeMessageMetadata;
  } catch {
    return {};
  }
}

function serializeThreadMessage(row: {
  id: number;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  metadataJson: string;
  createdAt: Date | null;
}): ConciergeThreadMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    intent: (row.intent as ConciergeThreadMessage["intent"]) ?? null,
    createdAtIso: toIso(row.createdAt),
    metadata: parseMetadata(row.metadataJson),
  };
}

async function getThreadBySessionKey(sessionKey: string) {
  const thread = await db.query.conciergeThreads.findFirst({
    where: eq(conciergeThreads.sessionKey, sessionKey),
  });

  if (!thread) {
    return null;
  }

  const messages = await db
    .select({
      id: conciergeMessages.id,
      role: conciergeMessages.role,
      content: conciergeMessages.content,
      intent: conciergeMessages.intent,
      metadataJson: conciergeMessages.metadataJson,
      createdAt: conciergeMessages.createdAt,
    })
    .from(conciergeMessages)
    .where(eq(conciergeMessages.threadId, thread.id))
    .orderBy(asc(conciergeMessages.createdAt), asc(conciergeMessages.id));

  return {
    thread,
    messages,
  };
}

async function ensureThread(sessionKey: string, clerkUserId: string | null) {
  let existing = await getThreadBySessionKey(sessionKey);

  if (!existing) {
    const created = await db
      .insert(conciergeThreads)
      .values({
        clerkUserId,
        sessionKey,
        title: "Nightly Concierge",
        status: "active",
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const thread = created[0];

    if (!thread) {
      throw new Error("Failed to create concierge thread");
    }

    const welcomeMetadata = buildConciergeWelcomeMessage(null);
    await db.insert(conciergeMessages).values({
      threadId: thread.id,
      role: "assistant",
      content: "I’m your Nightly Concierge. Tell me the vibe, the neighborhood, or the genre and I’ll narrow the city.",
      intent: "general",
      metadataJson: JSON.stringify(welcomeMetadata),
    });

    await writeAuditLog({
      actorClerkUserId: clerkUserId ?? "anonymous",
      actorRole: clerkUserId ? "consumer" : "anonymous",
      entityType: "concierge_thread",
      entityId: thread.id,
      action: "concierge_session_started",
      metadata: {
        sessionKey,
      },
    });

    existing = await getThreadBySessionKey(sessionKey);
  }

  if (!existing) {
    throw new Error("Unable to load concierge thread");
  }

  if (clerkUserId && !existing.thread.clerkUserId) {
    await db
      .update(conciergeThreads)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(eq(conciergeThreads.id, existing.thread.id));

    existing.thread.clerkUserId = clerkUserId;
  }

  return existing;
}

function serializeThread(thread: Awaited<ReturnType<typeof getThreadBySessionKey>> & NonNullable<Awaited<ReturnType<typeof getThreadBySessionKey>>>) {
  const messages = thread.messages.map((message) => serializeThreadMessage(message));

  return {
    id: thread.thread.id,
    title: thread.thread.title,
    sessionKey: thread.thread.sessionKey,
    status: thread.thread.status,
    createdAtIso: toIso(thread.thread.createdAt),
    updatedAtIso: toIso(thread.thread.updatedAt),
    lastMessageAtIso: toIso(thread.thread.lastMessageAt),
    messages,
  } satisfies ConciergeThreadPayload;
}

function getLatestRecommendations(messages: ConciergeThreadMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "assistant") {
      continue;
    }

    const metadata = message.metadata;
    if (metadata.recommendedVenues || metadata.recommendedEvents || metadata.cityPulse) {
      return {
        intent: metadata.intent ?? "general",
        summary: metadata.summary ?? "Nightly concierge is ready.",
        followUps: metadata.followUps ?? [],
        recommendedVenues: metadata.recommendedVenues ?? [],
        recommendedEvents: metadata.recommendedEvents ?? [],
        cityPulse: metadata.cityPulse ?? null,
      };
    }
  }

  return null;
}

export async function GET(request: Request) {
  const context = await getRequestContext("/api/concierge");

  try {
    const { userId } = await auth();
    const conciergeDisabled = await isKillSwitchEnabled("concierge", {
      userId: userId ?? undefined,
      role: userId ? "consumer" : "anonymous",
    });

    if (conciergeDisabled) {
      return NextResponse.json({ error: "Concierge is temporarily disabled." }, { status: 503 });
    }

    const url = new URL(request.url);
    const sessionKey = url.searchParams.get("sessionKey")?.trim();

    if (!sessionKey) {
      return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
    }

    const thread = await ensureThread(sessionKey, userId ?? null);

    return NextResponse.json({
      thread: serializeThread(thread),
      recommendations: getLatestRecommendations(thread.messages.map((message) => serializeThreadMessage(message))),
      starterPrompts: conciergeStarterPrompts,
    } satisfies ConciergeApiPayload);
  } catch (error) {
    logger.error("concierge_get_failed", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      error: error instanceof Error ? error.message : "unknown",
    });
    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "concierge_get",
    });
    return NextResponse.json({ error: "Failed to load concierge thread" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getRequestContext("/api/concierge");

  try {
    const { userId } = await auth();
    const conciergeDisabled = await isKillSwitchEnabled("concierge", {
      userId: userId ?? undefined,
      role: userId ? "consumer" : "anonymous",
    });

    if (conciergeDisabled) {
      return NextResponse.json({ error: "Concierge is temporarily disabled." }, { status: 503 });
    }

    const payload = (await request.json()) as {
      sessionKey?: string;
      message?: string;
    };

    const sessionKey = payload.sessionKey?.trim();
    const message = payload.message?.trim();

    if (!sessionKey) {
      return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const thread = await ensureThread(sessionKey, userId ?? null);
    const now = new Date();
    const discoveryContext = await Promise.all([getHomeData(), getExploreData()]);

    const recommendation = buildConciergeRecommendations({
      homeData: discoveryContext[0],
      exploreData: discoveryContext[1],
      message,
    });

    await db.insert(conciergeMessages).values({
      threadId: thread.thread.id,
      role: "user",
      content: message,
      metadataJson: JSON.stringify({
        submittedAtIso: now.toISOString(),
      }),
    });

    await db.insert(conciergeMessages).values({
      threadId: thread.thread.id,
      role: "assistant",
      content: recommendation.reply,
      intent: recommendation.intent,
      metadataJson: JSON.stringify(recommendation.metadata),
    });

    await db
      .update(conciergeThreads)
      .set({
        title: thread.thread.title === "Nightly Concierge" ? recommendation.title : thread.thread.title,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(conciergeThreads.id, thread.thread.id));

    await writeAuditLog({
      actorClerkUserId: userId ?? "anonymous",
      actorRole: userId ? "consumer" : "anonymous",
      entityType: "concierge_thread",
      entityId: thread.thread.id,
      action: "concierge_message_sent",
      metadata: {
        sessionKey,
        intent: recommendation.intent,
        messageLength: message.length,
        venueCount: recommendation.recommendedVenues.length,
        eventCount: recommendation.recommendedEvents.length,
      },
    });

    const refreshed = await getThreadBySessionKey(sessionKey);
    if (!refreshed) {
      throw new Error("Failed to refresh concierge thread");
    }

    const serializedThread = serializeThread(refreshed);
    const messages = serializedThread.messages;

    return NextResponse.json({
      thread: serializedThread,
      recommendations: getLatestRecommendations(messages),
      starterPrompts: conciergeStarterPrompts,
    } satisfies ConciergeApiPayload);
  } catch (error) {
    logger.error("concierge_post_failed", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      error: error instanceof Error ? error.message : "unknown",
    });
    await monitoring.capture(error, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      route: context.route,
      action: "concierge_post",
    });

    return NextResponse.json(
      {
        error: "Concierge is temporarily unavailable.",
        requestId: context.requestId,
      },
      { status: 503 }
    );
  }
}