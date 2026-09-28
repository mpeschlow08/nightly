import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";

import { db } from "@/db";
import { nightlyDeviceCapabilities, nightlyDeviceSources, nightlyDevices, venueCameras } from "@/db/schema";
import { assertNotSecretPayload } from "@/lib/nightly-device/foundation";
import { classifyNightlyDeviceInventoryWriteError } from "@/lib/nightly-device/database-errors";
import { authenticateDeviceRequest, canUseDeviceForManagement, canUseDeviceForOperationalManagement, createAuthError } from "@/lib/nightly-device/auth";
import { isCaptureSourceType } from "@/lib/nightly-device/policy";

export async function GET(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const [device] = await db
    .select({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, venueId: nightlyDevices.venueId, serialNumber: nightlyDevices.serialNumber, hardwareModel: nightlyDevices.hardwareModel, lifecycleState: nightlyDevices.lifecycleState, operationalState: nightlyDevices.operationalState, privacyMode: nightlyDevices.privacyMode })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, identity.id))
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const capabilities = await db
    .select({
      category: nightlyDeviceCapabilities.category,
      name: nightlyDeviceCapabilities.capabilityName,
      value: nightlyDeviceCapabilities.capabilityValue,
      supported: nightlyDeviceCapabilities.supported,
    })
    .from(nightlyDeviceCapabilities)
    .where(eq(nightlyDeviceCapabilities.deviceId, device.id));
  const sources = await db
    .select({ sourceType: nightlyDeviceSources.sourceType, sourceLabel: nightlyDeviceSources.sourceLabel, venueCameraId: nightlyDeviceSources.venueCameraId, enabled: nightlyDeviceSources.enabled })
    .from(nightlyDeviceSources)
    .where(eq(nightlyDeviceSources.deviceId, device.id));

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      uuid: device.publicDeviceUuid,
      venueId: device.venueId,
      serialNumber: device.serialNumber,
      hardwareModel: device.hardwareModel,
      lifecycleState: device.lifecycleState,
      operationalState: device.operationalState,
      privacyMode: device.privacyMode,
    },
    capabilities,
    sources,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const body = (await request.json().catch(() => null)) as { sources?: unknown } | null;
  if (!body || !Array.isArray(body.sources) || body.sources.length > 128) {
    return NextResponse.json(createAuthError("invalid_request", "A bounded sources array is required."), { status: 400 });
  }

  const [device] = await db.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId })
    .from(nightlyDevices).where(eq(nightlyDevices.id, identity.id)).limit(1);
  if (!device) return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  if (!device.venueId) return NextResponse.json(createAuthError("device_unassigned", "Device must be claimed before source inventory is reported."), { status: 409 });
  if (!await canUseDeviceForOperationalManagement(device.id)) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const sources = body.sources as Array<Record<string, unknown>>;
  const labels = new Set<string>();
  for (const source of sources) {
    if (!source || typeof source !== "object" || !isCaptureSourceType(source.sourceType) || typeof source.sourceLabel !== "string" || !source.sourceLabel.startsWith("agent:") || source.sourceLabel.length <= 6 || source.sourceLabel.trim() !== source.sourceLabel || source.sourceLabel.length > 120 || (source.enabled !== undefined && typeof source.enabled !== "boolean")) {
      return NextResponse.json(createAuthError("invalid_source", "Capture source is invalid."), { status: 400 });
    }
    const identityKey = `${source.sourceType}:${source.sourceLabel}`;
    if (labels.has(identityKey)) return NextResponse.json(createAuthError("invalid_source", "Capture source inventory contains duplicates."), { status: 400 });
    labels.add(identityKey);
    if (source.evidence !== undefined) {
      if (!source.evidence || typeof source.evidence !== "object" || Array.isArray(source.evidence)) {
        return NextResponse.json(createAuthError("invalid_source", "Capture source evidence must be an object."), { status: 400 });
      }
      try { assertNotSecretPayload(source.evidence); } catch {
        return NextResponse.json(createAuthError("invalid_source", "Sensitive source data is not allowed."), { status: 400 });
      }
    }
    if (source.sourceType === "ip_camera") {
      if (!Number.isInteger(source.venueCameraId)) return NextResponse.json(createAuthError("invalid_source", "IP camera sources must reference a venue camera."), { status: 400 });
      const [camera] = await db.select({ id: venueCameras.id })
        .from(venueCameras)
        .where(and(eq(venueCameras.id, source.venueCameraId as number), eq(venueCameras.venueId, device.venueId)))
        .limit(1);
      if (!camera) return NextResponse.json(createAuthError("invalid_source", "IP camera source is not available to this device's venue."), { status: 400 });
    } else if (source.venueCameraId !== undefined && source.venueCameraId !== null) {
      return NextResponse.json(createAuthError("invalid_source", "Only IP camera sources may reference venue cameras."), { status: 400 });
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(nightlyDeviceSources).where(and(eq(nightlyDeviceSources.deviceId, device.id), like(nightlyDeviceSources.sourceLabel, "agent:%")));
      if (sources.length) await tx.insert(nightlyDeviceSources).values(sources.map((source) => ({
        deviceId: device.id,
        venueId: device.venueId!,
        sourceType: source.sourceType as typeof nightlyDeviceSources.$inferInsert.sourceType,
        sourceLabel: (source.sourceLabel as string).trim(),
        venueCameraId: Number.isInteger(source.venueCameraId) ? source.venueCameraId as number : null,
        enabled: typeof source.enabled === "boolean" ? source.enabled : true,
        metadataJson: JSON.stringify(source.evidence ?? {}),
      })));
    });
  } catch (error) {
    const conflict = classifyNightlyDeviceInventoryWriteError(error);
    if (conflict) {
      return NextResponse.json(createAuthError(conflict.code, conflict.message), { status: conflict.status });
    }
    return NextResponse.json(createAuthError("inventory_update_failed", "Source inventory could not be updated."), { status: 500 });
  }

  return NextResponse.json({ ok: true, sourceCount: sources.length, timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
