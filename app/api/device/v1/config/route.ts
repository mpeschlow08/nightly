import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForOperationalManagement, createAuthError } from "@/lib/nightly-device/auth";

export async function GET(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const [device] = await db
    .select({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, venueId: nightlyDevices.venueId, desiredConfigRevision: nightlyDevices.desiredConfigRevision, serviceEntitlementState: nightlyDevices.serviceEntitlementState, privacyMode: nightlyDevices.privacyMode, contentEligibility: nightlyDevices.contentEligibility, publicPublishingEnabled: nightlyDevices.publicPublishingEnabled, hotReelEligible: nightlyDevices.hotReelEligible, liveEligible: nightlyDevices.liveEligible, privacyConfigRevision: nightlyDevices.privacyConfigRevision, serviceConfigRevision: nightlyDevices.serviceConfigRevision, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible })
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
        entitlementState: device.serviceEntitlementState,
        hotReelEligible: device.hotReelEligible,
        liveEligible: device.liveEligible,
        revision: device.serviceConfigRevision,
      },
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
