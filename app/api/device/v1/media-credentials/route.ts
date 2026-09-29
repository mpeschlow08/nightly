import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { nightlyDeviceSources, nightlyDevices, venueCameras } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForOperationalManagement, canUseDeviceForService, createAuthError } from "@/lib/nightly-device/auth";
import { canResolveDeviceMediaCredential, MEDIA_CREDENTIAL_TTL_SECONDS } from "@/lib/nightly-device/media-bindings";
import { canUseDeviceForOperationalManagement as operationalAllowed, canUseDeviceForService as serviceAllowed } from "@/lib/nightly-device/policy";

const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401, headers: responseHeaders });

  const body = await request.json().catch(() => null) as { sourceId?: unknown; expectedRevision?: unknown } | null;
  if (!body || !Number.isSafeInteger(body.sourceId) || (body.sourceId as number) <= 0 || typeof body.expectedRevision !== "string" || body.expectedRevision.length < 1 || body.expectedRevision.length > 128) {
    return NextResponse.json(createAuthError("invalid_request", "sourceId and expectedRevision are required."), { status: 400, headers: responseHeaders });
  }

  if (!await canUseDeviceForService(identity.id) || !await canUseDeviceForOperationalManagement(identity.id)) {
    return NextResponse.json(createAuthError("device_unavailable", "Device access is unavailable."), { status: 403, headers: responseHeaders });
  }

  return db.transaction(async (tx) => {
    const [device] = await tx.select({
      id: nightlyDevices.id, venueId: nightlyDevices.venueId,
      desiredConfigRevision: nightlyDevices.desiredConfigRevision,
      lifecycleState: nightlyDevices.lifecycleState, claimState: nightlyDevices.claimState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      contentEligibility: nightlyDevices.contentEligibility,
      hotReelEligible: nightlyDevices.hotReelEligible,
      publicPublishingEnabled: nightlyDevices.publicPublishingEnabled,
      managementRecoveryEligible: nightlyDevices.managementRecoveryEligible,
      managementAccessLevel: nightlyDevices.managementAccessLevel,
    }).from(nightlyDevices).where(eq(nightlyDevices.id, identity.id)).for("share").limit(1);

    if (!device || !device.venueId || !serviceAllowed(device) || !operationalAllowed(device) ||
      device.contentEligibility !== "approved" ||
      device.hotReelEligible !== true || device.publicPublishingEnabled !== true) {
      return NextResponse.json(createAuthError("device_unavailable", "Device access is unavailable."), { status: 403, headers: responseHeaders });
    }
    if (!device.desiredConfigRevision || device.desiredConfigRevision !== body.expectedRevision) {
      return NextResponse.json(createAuthError("config_revision_conflict", "Configuration revision is no longer current."), { status: 409, headers: responseHeaders });
    }

    const [source] = await tx.select({
      id: nightlyDeviceSources.id, deviceId: nightlyDeviceSources.deviceId,
      venueId: nightlyDeviceSources.venueId, sourceType: nightlyDeviceSources.sourceType,
      venueCameraId: nightlyDeviceSources.venueCameraId, enabled: nightlyDeviceSources.enabled,
      cameraVenueId: venueCameras.venueId, cameraStatus: venueCameras.status,
      cameraStreamType: venueCameras.streamType, streamUrl: venueCameras.streamUrl,
    }).from(nightlyDeviceSources)
      .innerJoin(venueCameras, and(eq(venueCameras.id, nightlyDeviceSources.venueCameraId), eq(venueCameras.venueId, nightlyDeviceSources.venueId)))
      .where(and(eq(nightlyDeviceSources.id, body.sourceId as number), eq(nightlyDeviceSources.deviceId, device.id), eq(nightlyDeviceSources.venueId, device.venueId), eq(nightlyDeviceSources.sourceType, "ip_camera"), eq(nightlyDeviceSources.enabled, true), eq(venueCameras.status, "enabled"), eq(venueCameras.streamType, "rtsp")))
      .limit(1);

    if (!source || !canResolveDeviceMediaCredential({ source, deviceId: device.id, venueId: device.venueId, expectedRevision: body.expectedRevision as string, desiredConfigRevision: device.desiredConfigRevision, streamUrl: source.streamUrl })) {
      return NextResponse.json(createAuthError("source_unavailable", "Source is unavailable."), { status: 404, headers: responseHeaders });
    }

    return NextResponse.json({
      ok: true, sourceId: source.id, configRevision: device.desiredConfigRevision,
      streamUrl: source.streamUrl, ttlSeconds: MEDIA_CREDENTIAL_TTL_SECONDS,
      expiresAt: new Date(Date.now() + MEDIA_CREDENTIAL_TTL_SECONDS * 1000).toISOString(),
    }, { headers: responseHeaders });
  });
}