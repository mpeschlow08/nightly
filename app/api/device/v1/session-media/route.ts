import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { artistPerformanceSessions, artistSessionHistory, artistSessionMedia, artistSessionSources, nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, createAuthError } from "@/lib/nightly-device/auth";
import { canUseDeviceForOperationalManagement, canUseDeviceForService } from "@/lib/nightly-device/policy";
import { withinSessionWindow } from "@/lib/artist-sessions/policy";

const headers = { "Cache-Control": "no-store" };
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{32}$/i.test(value);

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401, headers });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.publicId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.publicId) ||
      !Number.isSafeInteger(body.sourceId) || !validId(body.candidateId) || !validId(body.hotId) ||
      typeof body.mediaRevision !== "number" || !Number.isSafeInteger(body.mediaRevision) ||
      typeof body.configRevision !== "string" || body.configRevision.length > 128 ||
      typeof body.windowStartAt !== "string" || typeof body.windowEndAt !== "string")
    return NextResponse.json(createAuthError("invalid_request", "Session media reference is invalid."), { status: 400, headers });
  const start = new Date(body.windowStartAt);
  const end = new Date(body.windowEndAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end > new Date())
    return NextResponse.json(createAuthError("invalid_request", "Session media window is invalid."), { status: 400, headers });
  return db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId,
      desiredConfigRevision: nightlyDevices.desiredConfigRevision, lifecycleState: nightlyDevices.lifecycleState,
      claimState: nightlyDevices.claimState, serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible,
      managementAccessLevel: nightlyDevices.managementAccessLevel, contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible, publicPublishingEnabled: nightlyDevices.publicPublishingEnabled
    }).from(nightlyDevices).where(eq(nightlyDevices.id, identity.id)).for("share").limit(1);
    if (!device || device.venueId !== identity.venueId || device.desiredConfigRevision !== body.configRevision ||
        !canUseDeviceForService(device) || !canUseDeviceForOperationalManagement(device) ||
        device.contentEligibility !== "approved" || !device.hotReelEligible || !device.publicPublishingEnabled)
      return NextResponse.json(createAuthError("device_unavailable", "Device access is unavailable."), { status: 403, headers });
    const [session] = await tx.select().from(artistPerformanceSessions)
      .where(eq(artistPerformanceSessions.publicId, body.publicId as string)).for("share").limit(1);
    const [source] = session ? await tx.select().from(artistSessionSources).where(and(
      eq(artistSessionSources.sessionId, session.id), eq(artistSessionSources.sourceKey, body.sourceId as number),
      eq(artistSessionSources.deviceKey, identity.id), eq(artistSessionSources.configRevision, body.configRevision as string))).limit(1) : [];
    if (!session || !source || !withinSessionWindow(session, { venueId: identity.venueId ?? -1, start, end }) ||
        session.mediaRevision !== body.mediaRevision || source.deviceId !== identity.id)
      return NextResponse.json(createAuthError("source_unavailable", "Session media is unavailable."), { status: 403, headers });
    const [existing] = await tx.select({ id: artistSessionMedia.id }).from(artistSessionMedia).where(and(
      eq(artistSessionMedia.deviceId, identity.id), eq(artistSessionMedia.hotId, body.hotId as string))).limit(1);
    if (existing) return NextResponse.json({ ok: true, attributed: true }, { headers });
    const inserted = await tx.insert(artistSessionMedia).values({ sessionId: session.id, sessionSourceId: source.id,
      deviceId: identity.id, candidateId: body.candidateId as string, hotId: body.hotId as string,
      windowStartAt: start, windowEndAt: end, reviewState: "available", includeMicrophone: session.includeMicrophone }).onConflictDoNothing().returning({ id: artistSessionMedia.id });
    if (inserted.length) await tx.insert(artistSessionHistory).values({ sessionId: session.id, action: "media_attributed" });
    return NextResponse.json({ ok: true, attributed: true }, { headers });
  });
}