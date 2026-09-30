import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { artistPerformanceSessions, artistSessionSources, nightlyDeviceSources, nightlyDevices, venueCameras } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForOperationalManagement, createAuthError } from "@/lib/nightly-device/auth";
import { projectDeviceMediaConfig } from "@/lib/nightly-device/media-bindings";
import { artistSessionLeaseExpiresAt, sourceRole } from "@/lib/artist-sessions/policy";
import { expireStaleVenueSessions } from "@/lib/artist-sessions/service";
import { evaluateCommercialEntitlement, getDeviceCommercialDirective } from "@/lib/commercial-entitlements/service";

export async function GET(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const [device] = await db
    .select({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, venueId: nightlyDevices.venueId, desiredConfigRevision: nightlyDevices.desiredConfigRevision, privacyMode: nightlyDevices.privacyMode, contentEligibility: nightlyDevices.contentEligibility, publicPublishingEnabled: nightlyDevices.publicPublishingEnabled, hotReelEligible: nightlyDevices.hotReelEligible, liveEligible: nightlyDevices.liveEligible, privacyConfigRevision: nightlyDevices.privacyConfigRevision, serviceConfigRevision: nightlyDevices.serviceConfigRevision, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, identity.id))
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForOperationalManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const commercial = await getDeviceCommercialDirective(device.id);
  const commercialCapabilities = new Set(commercial.allowedCapabilities);
  const entitlementActive = commercialCapabilities.has("device.capture") && Date.parse(commercial.offlineEntitlementExpiresAt) > Date.now();

  if (device.venueId) await expireStaleVenueSessions(device.venueId);

  const mediaRows = device.venueId ? await db
    .select({
      id: nightlyDeviceSources.id,
      deviceId: nightlyDeviceSources.deviceId,
      venueId: nightlyDeviceSources.venueId,
      sourceType: nightlyDeviceSources.sourceType,
      venueCameraId: nightlyDeviceSources.venueCameraId,
      enabled: nightlyDeviceSources.enabled,
      cameraVenueId: venueCameras.venueId,
      cameraStatus: venueCameras.status,
      cameraStreamType: venueCameras.streamType,
    })
    .from(nightlyDeviceSources)
    .leftJoin(venueCameras, and(eq(venueCameras.id, nightlyDeviceSources.venueCameraId), eq(venueCameras.venueId, nightlyDeviceSources.venueId)))
    .where(and(eq(nightlyDeviceSources.deviceId, device.id), eq(nightlyDeviceSources.venueId, device.venueId))) : [];

  const activeSessions = device.venueId && device.desiredConfigRevision ? await db
    .select({ publicId: artistPerformanceSessions.publicId, venueId: artistPerformanceSessions.venueId, djProfileId: artistPerformanceSessions.djProfileId,
      startedAt: artistPerformanceSessions.startedAt, includeMicrophone: artistPerformanceSessions.includeMicrophone,
      mediaRevision: artistPerformanceSessions.mediaRevision, sourceId: artistSessionSources.sourceKey,
      role: artistSessionSources.role })
    .from(artistPerformanceSessions).innerJoin(artistSessionSources, eq(artistSessionSources.sessionId, artistPerformanceSessions.id))
    .where(and(eq(artistPerformanceSessions.venueId, device.venueId), eq(artistPerformanceSessions.status, "active"),
      eq(artistSessionSources.deviceKey, device.id))).limit(16) : [];
  const permittedSources = new Map(projectDeviceMediaConfig(mediaRows, device.id, device.venueId, device.desiredConfigRevision).sources
    .map((source) => [source.sourceId, sourceRole(source.sourceType)]));
  const performance = new Map<string, { publicId: string; deviceId: number; venueId: number;
    sources: Array<{ sourceId: number; role: "camera" | "program_audio" | "ambient_audio" }>;
    startedAt: string; leaseExpiresAt: string; includeMicrophone: boolean; mediaRevision: number }>();
  if (entitlementActive && commercialCapabilities.has("venue.artist_sessions") && device.contentEligibility === "approved" &&
      device.hotReelEligible && device.publicPublishingEnabled && device.venueId) {
    for (const row of activeSessions) {
      if (!row.startedAt || !row.role || permittedSources.get(row.sourceId) !== row.role) continue;
      const artistEntitlement = await evaluateCommercialEntitlement({ scope: "artist", scopeId: row.djProfileId, capability: "artist.performance_sessions" });
      if (!artistEntitlement.allowed) continue;
      const leaseExpiresAt = artistSessionLeaseExpiresAt(row.startedAt);
      if (!leaseExpiresAt || leaseExpiresAt <= new Date()) continue;
      const existing = performance.get(row.publicId);
      if (existing) existing.sources.push({ sourceId: row.sourceId, role: row.role });
      else performance.set(row.publicId, { publicId: row.publicId, deviceId: device.id, venueId: row.venueId,
        sources: [{ sourceId: row.sourceId, role: row.role }], startedAt: row.startedAt.toISOString(), includeMicrophone: row.includeMicrophone,
        leaseExpiresAt: leaseExpiresAt.toISOString(), mediaRevision: row.mediaRevision });
    }
  }

  return NextResponse.json({
    ok: true,
    deviceId: device.id,
    model: "nightly-box",
    venueId: device.venueId,
    configRevision: device.desiredConfigRevision,
    configAvailable: device.desiredConfigRevision !== null,
    sections: {
      privacy: {
        mode: device.privacyMode,
        contentEligibility: device.contentEligibility,
        publicPublishingEnabled: device.publicPublishingEnabled,
        revision: device.privacyConfigRevision,
      },
      service: {
        entitlementState: entitlementActive ? "active" : commercial.commercialState === "suspended" ? "suspended" : commercial.commercialState === "expired" ? "expired" : "inactive",
        hotReelEligible: entitlementActive && commercialCapabilities.has("venue.hot_reels") && commercialCapabilities.has("device.hot_moments") && device.hotReelEligible,
        liveEligible: entitlementActive && commercialCapabilities.has("venue.remote_media") && commercialCapabilities.has("device.remote_output") && device.liveEligible,
        revision: commercial.revision,
      },
      commercial,
      media: projectDeviceMediaConfig(mediaRows, device.id, device.venueId, device.desiredConfigRevision),
      performance: { revision: device.desiredConfigRevision, ttlSeconds: 300, sessions: [...performance.values()].slice(0, 4) },
      recovery: { enabled: device.managementRecoveryEligible },
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const body = (await request.json().catch(() => null)) as { configRevision?: string; appliedConfigRevision?: string } | null;
  if (!body || typeof body.configRevision !== "string" || body.configRevision.length < 1 || body.configRevision.length > 128 || (body.appliedConfigRevision !== undefined && body.appliedConfigRevision !== body.configRevision)) {
    return NextResponse.json(createAuthError("invalid_request", "configRevision is required."), { status: 400 });
  }

  const [device] = await db
    .select({ id: nightlyDevices.id, desiredConfigRevision: nightlyDevices.desiredConfigRevision })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, identity.id))
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForOperationalManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  if (!device.desiredConfigRevision || body.configRevision !== device.desiredConfigRevision) {
    return NextResponse.json(createAuthError("config_revision_conflict", "Configuration revision is no longer current."), { status: 409 });
  }

  const [updated] = await db.update(nightlyDevices).set({
    appliedConfigRevision: body.configRevision,
    lastConfigSyncAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(nightlyDevices.id, device.id),
    eq(nightlyDevices.desiredConfigRevision, body.configRevision)
  )).returning({ id: nightlyDevices.id });

  if (!updated) return NextResponse.json(createAuthError("config_revision_conflict", "Configuration revision is no longer current."), { status: 409 });

  return NextResponse.json({ ok: true, acknowledged: true, configRevision: body.configRevision, timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
